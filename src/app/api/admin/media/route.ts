import { NextResponse } from "next/server";
import { and, desc, ilike, inArray, like, or, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { getStaffUser } from "@/lib/session";
import { can } from "@/lib/rbac";

/** Media library search for the admin media picker. Staff only. */
export async function GET(req: Request) {
  const user = await getStaffUser();
  if (!user || !can(user.role, "content.view")) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const type = url.searchParams.get("type");
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 200);

  const where: SQL[] = [];
  if (ids.length) where.push(inArray(t.mediaAssets.id, ids));
  if (type === "image") where.push(like(t.mediaAssets.mimeType, "image/%"));
  if (type === "video") where.push(like(t.mediaAssets.mimeType, "video/%"));
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(t.mediaAssets.filename, pattern), ilike(t.mediaAssets.alt, pattern), ilike(t.mediaAssets.caption, pattern))!);
  }

  const rows = await db
    .select({
      id: t.mediaAssets.id,
      url: t.mediaAssets.url,
      posterUrl: t.mediaAssets.posterUrl,
      filename: t.mediaAssets.filename,
      alt: t.mediaAssets.alt,
      mimeType: t.mediaAssets.mimeType,
      rightsStatus: t.mediaAssets.rightsStatus,
    })
    .from(t.mediaAssets)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.mediaAssets.createdAt))
    .limit(ids.length ? 200 : 120);

  return NextResponse.json({ items: rows }, { headers: { "Cache-Control": "no-store" } });
}
