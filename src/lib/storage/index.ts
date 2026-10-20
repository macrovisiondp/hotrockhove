import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import type { StorageProviderName } from "@/db/schema";
import { env } from "@/lib/env";
import { getSettingFresh, revealSecret, type StorageSettings } from "@/lib/settings";

export type StoredFile = {
  provider: StorageProviderName;
  storageKey: string;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
};

export type UploadInput = { key: string; body: Buffer; contentType: string };

/** Business logic talks to this interface only. Media here is public (site imagery). */
export interface StorageAdapter {
  readonly provider: StorageProviderName;
  upload(input: UploadInput): Promise<StoredFile>;
  delete(storageKey: string, contentType: string): Promise<void>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

export class StorageNotConfiguredError extends Error {}

/* -------------------------------------------------------------------------- */
/* Local disk (development only)                                              */
/* -------------------------------------------------------------------------- */

export const LOCAL_MEDIA_ROOT = path.resolve(process.cwd(), ".data", "media");

export function resolveLocalKey(key: string): string {
  const full = path.resolve(LOCAL_MEDIA_ROOT, key);
  if (!full.startsWith(LOCAL_MEDIA_ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

function localAdapter(): StorageAdapter {
  if (!env().ALLOW_LOCAL_STORAGE) throw new StorageNotConfiguredError("Local storage is disabled (ALLOW_LOCAL_STORAGE).");
  return {
    provider: "local",
    async upload({ key, body }) {
      const full = resolveLocalKey(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      return { provider: "local", storageKey: key, url: `/media/${key}`, posterUrl: null, width: null, height: null };
    },
    async delete(key) {
      await rm(resolveLocalKey(key), { force: true });
    },
    async testConnection() {
      await mkdir(LOCAL_MEDIA_ROOT, { recursive: true });
      return { ok: true, message: "Local development storage is writable (not for production)." };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Cloudinary                                                                 */
/* -------------------------------------------------------------------------- */

export function cloudinaryAuth(s: StorageSettings) {
  const apiSecret = revealSecret(s.cloudinary.apiSecret);
  if (!s.cloudinary.cloudName || !s.cloudinary.apiKey || !apiSecret)
    throw new StorageNotConfiguredError("Cloudinary cloud name, API key and secret are required (Admin → Media settings).");
  return { cloud_name: s.cloudinary.cloudName, api_key: s.cloudinary.apiKey, api_secret: apiSecret };
}

export function cloudinaryFolder(s: StorageSettings) {
  return s.cloudinary.folder.replace(/^\/+|\/+$/g, "");
}

/** Poster frame URL for a Cloudinary video (first second, JPEG). */
export function cloudinaryPoster(cloudName: string, publicId: string) {
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_1,f_jpg,q_auto/${publicId}.jpg`;
}

function cloudinaryAdapter(s: StorageSettings): StorageAdapter {
  const auth = cloudinaryAuth(s);
  const folder = cloudinaryFolder(s);
  return {
    provider: "cloudinary",
    async upload({ key, body, contentType }) {
      const resourceType = contentType.startsWith("video/") ? "video" : "image";
      const publicId = (folder ? `${folder}/` : "") + key.replace(/\.[^.]+$/, "");
      const res = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { ...auth, public_id: publicId, resource_type: resourceType, overwrite: false, unique_filename: false },
          (err, r) => (err || !r ? reject(err ?? new Error("Empty Cloudinary response")) : resolve(r)),
        );
        stream.end(body);
      });
      return {
        provider: "cloudinary",
        storageKey: res.public_id,
        url: res.secure_url,
        posterUrl: resourceType === "video" ? cloudinaryPoster(auth.cloud_name, res.public_id) : null,
        width: res.width ?? null,
        height: res.height ?? null,
      };
    },
    async delete(storageKey, contentType) {
      await cloudinary.uploader.destroy(storageKey, {
        ...auth,
        resource_type: contentType.startsWith("video/") ? "video" : "image",
        invalidate: true,
      });
    },
    async testConnection() {
      try {
        await cloudinary.api.ping(auth);
        return { ok: true, message: `Connected to Cloudinary cloud "${auth.cloud_name}".` };
      } catch (err) {
        const code = (err as { error?: { http_code?: number } })?.error?.http_code;
        if (code === 401) return { ok: false, message: "Cloudinary rejected the API key or secret." };
        if (code === 404) return { ok: false, message: "Cloudinary cloud name not found." };
        return { ok: false, message: "Could not connect to Cloudinary. Check the cloud name, API key and secret." };
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                  */
/* -------------------------------------------------------------------------- */

export function buildAdapter(provider: StorageProviderName, s: StorageSettings): StorageAdapter {
  return provider === "local" ? localAdapter() : cloudinaryAdapter(s);
}

export async function getActiveStorage(): Promise<StorageAdapter> {
  const s = await getSettingFresh("storage");
  return buildAdapter(s.provider, s);
}

export async function getStorageFor(provider: StorageProviderName): Promise<StorageAdapter> {
  return buildAdapter(provider, await getSettingFresh("storage"));
}

/* -------------------------------------------------------------------------- */
/* Upload policy                                                              */
/* -------------------------------------------------------------------------- */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
/** Server-action uploads stay under Vercel's ~4.5 MB request limit. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Cloudinary free plan limit for a single video upload. Larger files must be compressed first. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Detect the real file type from its first bytes; the browser-supplied type is not trusted. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    return "video/mp4";
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** Server-generated storage key: <yyyy>/<mm>/<safe-original-name>-<short-hash>.<ext>. */
export function storageKeyFor(originalName: string, mime: string, sha256: string): string {
  const now = new Date();
  const base =
    originalName
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "file";
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${base}-${sha256.slice(0, 8)}.${EXT[mime] ?? "bin"}`;
}
