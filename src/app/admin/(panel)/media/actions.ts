"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { failure, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { getSettingFresh, mergeSecret, saveSetting, validateSetting } from "@/lib/settings";
import {
  buildAdapter,
  cloudinaryAuth,
  cloudinaryFolder,
  cloudinaryPoster,
  CLOUDINARY_MAX_VIDEO_BYTES,
  getActiveStorage,
  getStorageFor,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  presignS3Upload,
  S3_CACHE_CONTROL,
  s3Config,
  s3PublicUrl,
  sniffMime,
  storageKeyFor,
  StorageNotConfiguredError,
  VIDEO_TYPES,
} from "@/lib/storage";
import { invalidate } from "@/domain/content";
import { mediaUsage } from "@/domain/media-usage";

const uuid = z.string().uuid();

async function storeFile(file: File, userId: string, replaceId?: string): Promise<ActionState & { id?: string }> {
  if (!(file instanceof File) || file.size === 0) return failure("Choose a file to upload.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  const isImage = (IMAGE_TYPES as readonly string[]).includes(mime ?? "");
  const isVideo = (VIDEO_TYPES as readonly string[]).includes(mime ?? "");
  if (!isImage && !isVideo) return failure("Unsupported file. Upload JPEG, PNG, WebP or AVIF images, or MP4/WebM video.");
  if (isImage && buf.length > MAX_IMAGE_BYTES) return failure("Images must be under 4 MB here. Resize it (2000 px wide is plenty) and try again.");
  if (isVideo && buf.length > MAX_IMAGE_BYTES)
    return failure("Videos are uploaded directly to Cloudinary using the video uploader below (this form is limited to 4 MB).");

  const sha = createHash("sha256").update(buf).digest("hex");
  const dup = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.sha256, sha) });
  if (dup && dup.id !== replaceId) return { ...failure(`This file is already in the library as "${dup.filename}".`), id: dup.id };

  let width: number | null = null;
  let height: number | null = null;
  if (isImage) {
    try {
      const m = await sharp(buf).metadata();
      width = m.width ?? null;
      height = m.height ?? null;
      if ((width ?? 0) * (height ?? 0) > 50_000_000) return failure("Image dimensions are too large.");
    } catch {
      return failure("The image file appears to be damaged.");
    }
  }

  const storage = await getActiveStorage();
  const stored = await storage.upload({ key: storageKeyFor(file.name, mime!, sha), body: buf, contentType: mime! });
  const values = {
    provider: stored.provider,
    storageKey: stored.storageKey,
    url: stored.url,
    posterUrl: stored.posterUrl,
    filename: file.name.slice(0, 200),
    mimeType: mime!,
    bytes: buf.length,
    width: stored.width ?? width,
    height: stored.height ?? height,
    sha256: sha,
    uploadedById: userId,
  };
  if (replaceId) {
    const old = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, replaceId) });
    if (!old) return failure("Unknown media.");
    await db.update(t.mediaAssets).set(values).where(eq(t.mediaAssets.id, replaceId));
    // Remove the previous file from storage; references keep working because the id is unchanged.
    try {
      await (await getStorageFor(old.provider)).delete(old.storageKey, old.mimeType);
    } catch {
      /* best effort */
    }
    return { ...success("File replaced. Everywhere it's used now shows the new file."), id: replaceId };
  }
  const [row] = await db.insert(t.mediaAssets).values({ ...values, altStatus: "missing" }).returning({ id: t.mediaAssets.id });
  return { ...success(`Uploaded ${file.name}.`), id: row.id };
}

export async function uploadMediaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("media.upload");
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return failure("Choose at least one file.");
    if (files.length > 10) return failure("Upload up to 10 files at a time.");
    const results: string[] = [];
    let ok = 0;
    for (const f of files) {
      try {
        const r = await storeFile(f, user.id);
        if (r.ok) {
          ok++;
          await audit("media.upload", { actorUserId: user.id, entityType: "media", entityId: r.id, metadata: { filename: f.name, bytes: f.size } });
        } else results.push(`${f.name}: ${r.message}`);
      } catch (err) {
        results.push(`${f.name}: ${err instanceof StorageNotConfiguredError ? err.message : "upload failed"}`);
      }
    }
    invalidate("media");
    if (ok === files.length) return success(`${ok} file(s) uploaded. Add a description (alt text) to each one.`);
    return failure(`${ok} of ${files.length} uploaded. ${results.join(" · ")}`);
  });
}

const metaSchema = z.object({
  alt: z.string().trim().max(300),
  caption: z.string().trim().max(300),
  altStatus: z.enum(["ok", "missing", "needs_review"]),
  rightsStatus: z.enum(["cleared", "unconfirmed", "excluded"]),
  rightsNote: z.string().trim().max(500),
});

export async function updateMediaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("media.upload");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown media.");
    const alt = str(fd, "alt");
    const decorative = fd.get("decorative") === "on";
    const parsed = metaSchema.safeParse({
      alt: decorative ? "" : alt,
      caption: str(fd, "caption"),
      // Saving a description marks it reviewed; an empty one is "missing" unless decorative.
      altStatus: decorative ? "ok" : alt ? "ok" : "missing",
      rightsStatus: str(fd, "rightsStatus"),
      rightsNote: str(fd, "rightsNote"),
    });
    if (!parsed.success) return failure("Please check the fields.", { alt: parsed.error.issues[0].message });
    await db.update(t.mediaAssets).set(parsed.data).where(eq(t.mediaAssets.id, id));
    invalidate("media", "pages");
    await audit("media.update", { actorUserId: user.id, entityType: "media", entityId: id, metadata: { rights: parsed.data.rightsStatus } });
    return success(parsed.data.rightsStatus === "excluded" ? "Saved. This file is now hidden everywhere on the site." : "Saved.");
  });
}

export async function replaceMediaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("media.upload");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown media.");
    const file = fd.get("file");
    if (!(file instanceof File)) return failure("Choose a file.");
    const r = await storeFile(file, user.id, id);
    if (r.ok) {
      invalidate("media", "pages");
      await audit("media.replace", { actorUserId: user.id, entityType: "media", entityId: id, metadata: { filename: file.name } });
    }
    return r;
  });
}

export async function deleteMediaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("media.delete");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown media.");
    const asset = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, id) });
    if (!asset) return failure("Already deleted.");
    const usage = await mediaUsage(id, asset.url);
    if (usage.length) return failure(`Still used by: ${usage.map((u) => `${u.kind} "${u.label}"`).join(", ")}. Remove it there first.`);
    try {
      await (await getStorageFor(asset.provider)).delete(asset.storageKey, asset.mimeType);
    } catch (err) {
      if (!(err instanceof StorageNotConfiguredError)) return failure("The file couldn't be removed from storage. Nothing was deleted.");
    }
    await db.delete(t.mediaAssets).where(eq(t.mediaAssets.id, id));
    invalidate("media");
    await audit("media.delete", { actorUserId: user.id, entityType: "media", entityId: id, metadata: { filename: asset.filename } });
    redirect("/admin/media?deleted=1");
  });
}

/* --------------------------- direct video upload --------------------------- */

export type VideoUploadTicket =
  | { ok: true; provider: "s3"; uploadUrl: string; objectKey: string; headers: Record<string, string> }
  | { ok: true; provider: "cloudinary"; cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }
  | { ok: false; message: string };

const videoRequest = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(["video/mp4", "video/webm"]),
  bytes: z.number().int().positive(),
});

/**
 * Permission to upload one video straight from the browser to storage, avoiding
 * Vercel's ~4.5 MB request limit. S3: a presigned PUT (15 min) for exactly this
 * size and type. Cloudinary: signed upload parameters. Secrets never leave the server.
 */
export async function requestVideoUploadAction(input: { filename: string; contentType: string; bytes: number }): Promise<VideoUploadTicket> {
  try {
    await assertPermission("media.upload");
    const req = videoRequest.safeParse(input);
    if (!req.success) return { ok: false, message: "Choose an MP4 or WebM video." };
    const s = await getSettingFresh("storage");
    if (s.provider === "s3") {
      if (req.data.bytes > MAX_VIDEO_BYTES) return { ok: false, message: "Videos must be under 500 MB. Compress it first (e.g. HandBrake, 1080p, H.264)." };
      const safeName = req.data.filename.replace(/[^A-Za-z0-9.]+/g, "-").toLowerCase().slice(-80);
      const key = `${new Date().getUTCFullYear()}/videos/${randomUUID()}-${safeName}`;
      const p = await presignS3Upload(s, key, req.data.contentType, req.data.bytes);
      // The browser must send exactly the signed headers.
      return { ok: true, provider: "s3", uploadUrl: p.url, objectKey: p.objectKey, headers: { "Content-Type": req.data.contentType, "Cache-Control": S3_CACHE_CONTROL } };
    }
    if (s.provider === "cloudinary") {
      if (req.data.bytes > CLOUDINARY_MAX_VIDEO_BYTES) return { ok: false, message: "Cloudinary's plan allows videos up to 100 MB." };
      const auth = cloudinaryAuth(s);
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = cloudinaryFolder(s);
      const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, auth.api_secret);
      return { ok: true, provider: "cloudinary", cloudName: auth.cloud_name, apiKey: auth.api_key, timestamp, signature, folder };
    }
    return { ok: false, message: "Video uploads need S3 or Cloudinary (Media → Storage settings)." };
  } catch (err) {
    return { ok: false, message: err instanceof StorageNotConfiguredError ? err.message : "Not allowed." };
  }
}

/**
 * Register a video the browser uploaded, after checking it on the storage side:
 * it must exist, be within the size limit and really be MP4/WebM (first bytes).
 * Anything else is deleted from the bucket.
 */
export async function registerVideoAction(ref: string, filename: string): Promise<{ ok: boolean; message: string; id?: string }> {
  try {
    const user = await assertPermission("media.upload");
    const s = await getSettingFresh("storage");
    let values: typeof t.mediaAssets.$inferInsert;

    if (s.provider === "s3") {
      const { client, bucket, prefix, publicBase } = s3Config(s);
      if (!/^[A-Za-z0-9._\-/]{1,400}$/.test(ref) || (prefix && !ref.startsWith(prefix + "/"))) return { ok: false, message: "Invalid upload reference." };
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: ref }));
      const bytes = head.ContentLength ?? 0;
      const first = await client.send(new GetObjectCommand({ Bucket: bucket, Key: ref, Range: "bytes=0-63" }));
      const sniffed = sniffMime(Buffer.from(await first.Body!.transformToByteArray()));
      if (!sniffed?.startsWith("video/") || bytes > MAX_VIDEO_BYTES) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: ref })).catch(() => {});
        return { ok: false, message: "That file isn't a supported video, so it was removed." };
      }
      values = {
        provider: "s3",
        storageKey: ref,
        url: s3PublicUrl(publicBase, ref),
        posterUrl: null,
        filename: filename.slice(0, 200),
        mimeType: sniffed,
        bytes,
        width: null,
        height: null,
        sha256: createHash("sha256").update(`s3:${bucket}:${ref}:${head.ETag ?? ""}`).digest("hex"),
        altStatus: "missing",
        uploadedById: user.id,
      };
    } else if (s.provider === "cloudinary") {
      if (!/^[A-Za-z0-9_\-/]{1,300}$/.test(ref)) return { ok: false, message: "Invalid upload reference." };
      const auth = cloudinaryAuth(s);
      const folder = cloudinaryFolder(s);
      if (folder && !ref.startsWith(folder + "/")) return { ok: false, message: "Upload went to an unexpected folder." };
      const res = (await cloudinary.api.resource(ref, { ...auth, resource_type: "video" })) as {
        secure_url: string;
        bytes: number;
        width: number;
        height: number;
        format: string;
        etag: string;
      };
      if (res.bytes > CLOUDINARY_MAX_VIDEO_BYTES) return { ok: false, message: "Video is larger than 100 MB." };
      values = {
        provider: "cloudinary",
        storageKey: ref,
        url: res.secure_url,
        posterUrl: cloudinaryPoster(auth.cloud_name, ref),
        filename: filename.slice(0, 200),
        mimeType: res.format === "webm" ? "video/webm" : "video/mp4",
        bytes: res.bytes,
        width: res.width,
        height: res.height,
        sha256: createHash("sha256").update(`cloudinary:${ref}:${res.etag}`).digest("hex"),
        altStatus: "missing",
        uploadedById: user.id,
      };
    } else {
      return { ok: false, message: "Video uploads need S3 or Cloudinary." };
    }

    const [row] = await db.insert(t.mediaAssets).values(values).onConflictDoNothing({ target: t.mediaAssets.sha256 }).returning({ id: t.mediaAssets.id });
    invalidate("media");
    await audit("media.upload", { actorUserId: user.id, entityType: "media", entityId: row?.id, metadata: { filename, bytes: values.bytes, video: true } });
    return {
      ok: true,
      message: s.provider === "s3" ? "Video uploaded. Open it to choose a poster image and add a description." : "Video uploaded.",
      id: row?.id,
    };
  } catch {
    return { ok: false, message: "Couldn't confirm the upload with the storage provider." };
  }
}

/** Use an image from the library as a video's poster (S3 doesn't generate posters). */
export async function setPosterAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("media.upload");
    const id = str(fd, "id");
    const posterId = str(fd, "posterId");
    if (!uuid.safeParse(id).success) return failure("Unknown media.");
    let posterUrl: string | null = null;
    if (posterId) {
      if (!uuid.safeParse(posterId).success) return failure("Choose an image.");
      const img = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, posterId) });
      if (!img || !img.mimeType.startsWith("image/")) return failure("The poster must be an image.");
      posterUrl = img.url;
    }
    await db.update(t.mediaAssets).set({ posterUrl }).where(eq(t.mediaAssets.id, id));
    invalidate("media", "pages");
    await audit("media.update", { actorUserId: user.id, entityType: "media", entityId: id, metadata: { poster: Boolean(posterUrl) } });
    return success(posterUrl ? "Poster set." : "Poster removed.");
  });
}

/* ------------------------------ storage settings ----------------------------- */

export async function saveStorageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const current = await getSettingFresh("storage");
    const newS3Secret = str(fd, "s3SecretAccessKey");
    const newCloudinarySecret = str(fd, "apiSecret");
    const keyChanged = str(fd, "s3AccessKeyId") !== current.s3.accessKeyId;
    if (newS3Secret || newCloudinarySecret || (keyChanged && current.s3.accessKeyId)) {
      const owner = await assertPermission("secrets.edit").catch(() => null);
      if (!owner) return failure("Only the owner can change storage access keys.");
    }
    const provider = str(fd, "provider");
    const next = {
      provider: (provider === "local" ? "local" : provider === "cloudinary" ? "cloudinary" : "s3") as "s3" | "cloudinary" | "local",
      s3: {
        bucket: str(fd, "s3Bucket").toLowerCase(),
        region: str(fd, "s3Region"),
        accessKeyId: str(fd, "s3AccessKeyId"),
        secretAccessKey: mergeSecret(current.s3.secretAccessKey, newS3Secret),
        prefix: str(fd, "s3Prefix").replace(/^\/+|\/+$/g, "") || "hotrockhove",
        publicBaseUrl: str(fd, "s3PublicBaseUrl").replace(/\/+$/, ""),
        endpoint: str(fd, "s3Endpoint").replace(/\/+$/, ""),
      },
      cloudinary: {
        cloudName: str(fd, "cloudName") || current.cloudinary.cloudName,
        apiKey: str(fd, "apiKey") || current.cloudinary.apiKey,
        apiSecret: mergeSecret(current.cloudinary.apiSecret, newCloudinarySecret),
        folder: str(fd, "folder") || current.cloudinary.folder,
      },
    };
    const parsed = validateSetting("storage", next);
    if (!parsed.success) return zodFailure(parsed.error);
    if (parsed.data.s3.bucket && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(parsed.data.s3.bucket))
      return failure("That isn't a valid S3 bucket name.", { s3Bucket: "Lowercase letters, numbers, dots and hyphens" });
    if (parsed.data.provider === "local" && process.env.VERCEL) return failure("Local storage isn't available on Vercel.");
    await saveSetting("storage", parsed.data, user.id);
    await audit(newS3Secret || newCloudinarySecret ? "secret.update" : "settings.update", {
      actorUserId: user.id,
      entityType: "settings",
      entityId: "storage",
      metadata: { provider: parsed.data.provider, bucket: parsed.data.s3.bucket, region: parsed.data.s3.region },
    });
    return success("Media storage settings saved. Use “Test now” to check uploads and public access.");
  });
}

export async function testStorageAction(): Promise<ActionState> {
  return guarded(async () => {
    await assertPermission("settings.edit");
    const s = await getSettingFresh("storage");
    try {
      const r = await buildAdapter(s.provider, s).testConnection();
      return r.ok ? success(r.message) : failure(r.message);
    } catch (err) {
      return failure(err instanceof StorageNotConfiguredError ? err.message : "Connection test failed.");
    }
  });
}
