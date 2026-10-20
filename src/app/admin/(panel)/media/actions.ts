"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { getSettingFresh, mergeSecret, saveSetting, validateSetting } from "@/lib/settings";
import {
  buildAdapter,
  cloudinaryAuth,
  cloudinaryFolder,
  cloudinaryPoster,
  getActiveStorage,
  getStorageFor,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
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

/**
 * Signed parameters for a browser → Cloudinary upload (videos up to 100 MB),
 * avoiding Vercel's request-size limit. The browser never sees the API secret.
 */
export async function signVideoUploadAction(): Promise<
  { ok: true; cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string } | { ok: false; message: string }
> {
  try {
    await assertPermission("media.upload");
    const s = await getSettingFresh("storage");
    if (s.provider !== "cloudinary") return { ok: false, message: "Large video uploads need Cloudinary (Media settings)." };
    const auth = cloudinaryAuth(s);
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = cloudinaryFolder(s);
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, auth.api_secret);
    return { ok: true, cloudName: auth.cloud_name, apiKey: auth.api_key, timestamp, signature, folder };
  } catch (err) {
    return { ok: false, message: err instanceof StorageNotConfiguredError ? err.message : "Not allowed." };
  }
}

/** Register a video the browser uploaded to Cloudinary, after verifying it exists there. */
export async function registerVideoAction(publicId: string, filename: string): Promise<{ ok: boolean; message: string; id?: string }> {
  try {
    const user = await assertPermission("media.upload");
    if (!/^[A-Za-z0-9_\-/]{1,300}$/.test(publicId)) return { ok: false, message: "Invalid upload reference." };
    const s = await getSettingFresh("storage");
    const auth = cloudinaryAuth(s);
    const folder = cloudinaryFolder(s);
    if (folder && !publicId.startsWith(folder + "/")) return { ok: false, message: "Upload went to an unexpected folder." };
    const res = (await cloudinary.api.resource(publicId, { ...auth, resource_type: "video" })) as {
      secure_url: string;
      bytes: number;
      width: number;
      height: number;
      format: string;
      etag: string;
    };
    if (res.bytes > MAX_VIDEO_BYTES) return { ok: false, message: "Video is larger than 100 MB." };
    const sha = createHash("sha256").update(`cloudinary:${publicId}:${res.etag}`).digest("hex");
    const [row] = await db
      .insert(t.mediaAssets)
      .values({
        provider: "cloudinary",
        storageKey: publicId,
        url: res.secure_url,
        posterUrl: cloudinaryPoster(auth.cloud_name, publicId),
        filename: filename.slice(0, 200),
        mimeType: res.format === "webm" ? "video/webm" : "video/mp4",
        bytes: res.bytes,
        width: res.width,
        height: res.height,
        sha256: sha,
        altStatus: "missing",
        uploadedById: user.id,
      })
      .onConflictDoNothing({ target: t.mediaAssets.sha256 })
      .returning({ id: t.mediaAssets.id });
    invalidate("media");
    await audit("media.upload", { actorUserId: user.id, entityType: "media", entityId: row?.id, metadata: { filename, bytes: res.bytes, video: true } });
    return { ok: true, message: "Video uploaded.", id: row?.id };
  } catch {
    return { ok: false, message: "Couldn't confirm the upload with Cloudinary." };
  }
}

/* ------------------------------ storage settings ----------------------------- */

export async function saveStorageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const current = await getSettingFresh("storage");
    const newSecret = str(fd, "apiSecret");
    if (newSecret) {
      const owner = await assertPermission("secrets.edit").catch(() => null);
      if (!owner) return failure("Only the owner can change the Cloudinary API secret.");
    }
    const next = {
      provider: str(fd, "provider") === "local" ? ("local" as const) : ("cloudinary" as const),
      cloudinary: {
        cloudName: str(fd, "cloudName"),
        apiKey: str(fd, "apiKey"),
        apiSecret: mergeSecret(current.cloudinary.apiSecret, newSecret),
        folder: str(fd, "folder") || "hotrockhove",
      },
    };
    const parsed = validateSetting("storage", next);
    if (!parsed.success) return failure("Please check the fields.");
    if (parsed.data.provider === "local" && process.env.VERCEL) return failure("Local storage isn't available on Vercel.");
    await saveSetting("storage", parsed.data, user.id);
    await audit(newSecret ? "secret.update" : "settings.update", { actorUserId: user.id, entityType: "settings", entityId: "storage", metadata: { provider: parsed.data.provider } });
    return success("Media storage settings saved.");
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
