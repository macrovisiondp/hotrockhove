/**
 * Import the WordPress media used by migrated pages into the active storage
 * provider (Admin → Media settings: Cloudinary, or local disk in development).
 *
 *   npm run media:import            # import everything not yet imported
 *   npm run media:import -- --dry   # report only
 *
 * Repeatable: files are cached in .data/media-staging, de-duplicated by SHA-256,
 * and skipped when an asset with the same checksum already exists. Writes a
 * migration report to docs/data/media-migration-report.json.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, t } from "../src/db";
import { CLOUDINARY_MAX_VIDEO_BYTES, getActiveStorage, MAX_VIDEO_BYTES, sniffMime } from "../src/lib/storage";
import { classifyRights, MEDIA_PATHS, WP_UPLOADS } from "./data/media-manifest";

type WpItem = { url: string; w: number | null; h: number | null; alt: string };

const STAGING = path.resolve(".data", "media-staging");
const dry = process.argv.includes("--dry");

async function download(rel: string): Promise<Buffer> {
  const file = path.join(STAGING, rel);
  try {
    if ((await stat(file)).size > 0) return readFile(file);
  } catch {
    /* not cached */
  }
  const url = WP_UPLOADS + rel.split("/").map(encodeURIComponent).join("/");
  // node:https rather than fetch: importing next/cache patches global fetch for the Next.js runtime.
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "HotRockHove-Migration/1.0" }, timeout: 180_000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
  });
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return buf;
}

async function main() {
  const inventory: WpItem[] = JSON.parse(await readFile("docs/data/media-inventory.json", "utf8"));
  const byPath = new Map(inventory.map((i) => [decodeURIComponent(i.url.split("/wp-content/uploads/")[1] ?? ""), i]));
  const storage = dry ? null : await getActiveStorage();
  console.log(dry ? "Dry run." : `Importing to ${storage!.provider}.`);

  const report: Record<string, unknown>[] = [];
  let imported = 0;
  let existing = 0;
  let failed = 0;

  for (const rel of MEDIA_PATHS) {
    const sourceUrl = WP_UPLOADS + rel;
    try {
      const buf = await download(rel);
      const sha = createHash("sha256").update(buf).digest("hex");
      const mime = sniffMime(buf);
      if (!mime) throw new Error("Unsupported file type");

      const dup = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.sha256, sha) });
      if (dup) {
        existing++;
        report.push({ path: rel, status: dup.sourceUrl === sourceUrl ? "already-imported" : "duplicate-of", id: dup.id, duplicateOf: dup.sourceUrl });
        continue;
      }

      const rights = classifyRights(rel);
      const wp = byPath.get(rel);
      let width = wp?.w ?? null;
      let height = wp?.h ?? null;
      if (mime.startsWith("image/")) {
        const meta = await sharp(buf).metadata();
        width = meta.width ?? width;
        height = meta.height ?? height;
      }

      const videoLimit = storage?.provider === "cloudinary" ? CLOUDINARY_MAX_VIDEO_BYTES : MAX_VIDEO_BYTES;
      if (mime.startsWith("video/") && buf.length > videoLimit) {
        failed++;
        report.push({ path: rel, status: "skipped-too-large", bytes: buf.length, note: `Over the ${Math.round(videoLimit / 1048576)} MB upload limit. Compress (e.g. HandBrake, 1080p H.264) and upload in Admin → Media.` });
        continue;
      }
      if (dry) {
        report.push({ path: rel, status: "would-import", bytes: buf.length, mime, rights: rights.status });
        continue;
      }

      const key = `wp/${rel}`.replace(/[^A-Za-z0-9._/-]+/g, "-");
      const stored = await storage!.upload({ key, body: buf, contentType: mime });
      const alt = (wp?.alt ?? "").trim();
      const [row] = await db
        .insert(t.mediaAssets)
        .values({
          provider: stored.provider,
          storageKey: stored.storageKey,
          url: stored.url,
          posterUrl: stored.posterUrl,
          filename: rel.split("/").pop()!,
          mimeType: mime,
          bytes: buf.length,
          width: stored.width ?? width,
          height: stored.height ?? height,
          sha256: sha,
          alt,
          altStatus: alt ? "needs_review" : "missing",
          sourceUrl,
          rightsStatus: rights.status,
          rightsNote: rights.note,
        })
        .returning({ id: t.mediaAssets.id });
      imported++;
      report.push({ path: rel, status: "imported", id: row.id, bytes: buf.length, mime, rights: rights.status });
      process.stdout.write(".");
    } catch (err) {
      failed++;
      report.push({ path: rel, status: "error", error: (err as Error).message });
      console.error(`\n${rel}: ${(err as Error).message}`);
    }
  }

  await writeFile(
    "docs/data/media-migration-report.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), totals: { listed: MEDIA_PATHS.length, imported, existing, failed }, items: report }, null, 1),
  );
  console.log(`\nListed ${MEDIA_PATHS.length}: imported ${imported}, already present ${existing}, skipped/failed ${failed}.`);
  process.exit(failed ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
