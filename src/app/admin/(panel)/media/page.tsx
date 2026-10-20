import Link from "next/link";
import { and, desc, eq, ilike, like, or, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { ActionForm } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader, formatBytes } from "@/components/admin/ui";
import { uploadMediaAction } from "./actions";
import { VideoUploader } from "./video-uploader";

export const metadata = { title: "Media" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
];

export default async function MediaAdmin({ searchParams }: PageProps<"/admin/media">) {
  const user = await requirePermission("content.view");
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const rights = sp.rights === "unconfirmed" ? "unconfirmed" : "";
  const altAttention = sp.alt === "attention";

  const where: SQL[] = [];
  if (type === "image") where.push(like(t.mediaAssets.mimeType, "image/%"));
  if (type === "video") where.push(like(t.mediaAssets.mimeType, "video/%"));
  if (rights) where.push(eq(t.mediaAssets.rightsStatus, "unconfirmed"));
  if (altAttention) where.push(or(eq(t.mediaAssets.altStatus, "missing"), eq(t.mediaAssets.altStatus, "needs_review"))!);
  if (q) where.push(or(ilike(t.mediaAssets.filename, `%${q}%`), ilike(t.mediaAssets.alt, `%${q}%`))!);

  const [items, storage] = await Promise.all([
    db.select().from(t.mediaAssets).where(where.length ? and(...where) : undefined).orderBy(desc(t.mediaAssets.createdAt)).limit(300),
    getSettingFresh("storage"),
  ]);
  const canUpload = can(user.role, "media.upload");
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(type && { type }), ...(q && { q }), ...(rights && { rights }), ...(altAttention && { alt: "attention" }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/admin/media${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Media"
        description="Photos and videos used across the site. Add a short description (alt text) to every image so it's accessible and findable."
        actions={
          can(user.role, "settings.edit") && (
            <Link href="/admin/media/settings" className="admin-btn admin-btn-secondary">
              Storage settings
            </Link>
          )
        }
      />
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Notice tone="good">File deleted.</Notice>
        </div>
      )}
      {storage.provider === "local" && (
        <div className="mb-4">
          <Notice tone="info">Development mode: files are stored on this computer. Configure the S3 bucket before launch.</Notice>
        </div>
      )}

      {canUpload && (
        <Card title="Upload" className="mb-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ActionForm action={uploadMediaAction} submitLabel="Upload" showCancel={false} resetOnSuccess compact>
              <label className="block text-sm font-medium">
                Images (JPEG, PNG, WebP, AVIF; up to 4 MB each, 10 at a time)
                <input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="mt-1.5 block text-sm" />
              </label>
            </ActionForm>
            {storage.provider === "local" ? (
              <p className="text-sm text-[#6b665e]">Videos upload straight from your browser to the S3 bucket, so they&apos;re available once S3 is configured.</p>
            ) : (
              <VideoUploader maxMb={storage.provider === "s3" ? 500 : 100} />
            )}
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={qs({ type: f.key })} aria-current={type === f.key ? "page" : undefined} className="rounded-full border border-[#d6d3cd] px-3 py-1 text-sm aria-[current=page]:border-[#1c1b19] aria-[current=page]:bg-[#1c1b19] aria-[current=page]:text-white">
            {f.label}
          </Link>
        ))}
        <Link href={qs({ alt: altAttention ? "" : "attention" })} aria-current={altAttention ? "page" : undefined} className="rounded-full border border-[#d6d3cd] px-3 py-1 text-sm aria-[current=page]:border-amber-600 aria-[current=page]:bg-amber-50">
          Needs description
        </Link>
        <Link href={qs({ rights: rights ? "" : "unconfirmed" })} aria-current={rights ? "page" : undefined} className="rounded-full border border-[#d6d3cd] px-3 py-1 text-sm aria-[current=page]:border-amber-600 aria-[current=page]:bg-amber-50">
          Rights unconfirmed
        </Link>
        <form action="/admin/media" className="ml-auto flex gap-2">
          {type && <input type="hidden" name="type" value={type} />}
          <input name="q" defaultValue={q} placeholder="Search" aria-label="Search media" className="admin-input w-48" />
        </form>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d6d3cd] p-8 text-center text-sm text-[#6b665e]">No files match.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((m) => {
            const isVideo = m.mimeType.startsWith("video/");
            const thumb = isVideo ? m.posterUrl : m.url;
            return (
              <li key={m.id}>
                <Link href={`/admin/media/${m.id}`} className="admin-card block overflow-hidden hover:border-[#a8a39b]">
                  <span className="relative block aspect-square bg-[#e9e6e1]">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin grid thumbnails
                      <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-[#6b665e]">{isVideo ? "Video" : "No preview"}</span>
                    )}
                  </span>
                  <span className="block p-2">
                    <span className="block truncate text-xs font-medium">{m.alt || m.filename}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <span className="text-[11px] text-[#8a847b]">{formatBytes(m.bytes)}</span>
                      {m.altStatus !== "ok" && <Badge tone="warn">{m.altStatus === "missing" ? "No description" : "Check description"}</Badge>}
                      {m.rightsStatus !== "cleared" && <Badge tone={m.rightsStatus === "excluded" ? "bad" : "warn"}>Rights {m.rightsStatus}</Badge>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
