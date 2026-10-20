import { readFile, stat } from "node:fs/promises";
import { env } from "@/lib/env";
import { resolveLocalKey, sniffMime } from "@/lib/storage";

/**
 * Serves media from the local development store (.data/media). Disabled unless
 * ALLOW_LOCAL_STORAGE=true, which is refused on Vercel. Production media is
 * delivered by Cloudinary directly.
 */
export async function GET(req: Request, { params }: RouteContext<"/media/[...key]">) {
  if (!env().ALLOW_LOCAL_STORAGE) return new Response("Not found", { status: 404 });
  const { key } = await params;
  let file: string;
  try {
    file = resolveLocalKey(key.map(decodeURIComponent).join("/"));
    const st = await stat(file);
    if (!st.isFile()) throw new Error();
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const body = await readFile(file);
  const type = sniffMime(body) ?? "application/octet-stream";
  const total = body.length;

  // Range support so videos can seek in development.
  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
    if (start <= end && start < total) {
      return new Response(new Uint8Array(body.subarray(start, end + 1)), {
        status: 206,
        headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${total}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
      });
    }
  }
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": type, "Content-Length": String(total), "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
