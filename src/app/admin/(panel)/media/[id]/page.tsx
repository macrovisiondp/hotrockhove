import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { mediaUsage } from "@/domain/media-usage";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader, formatBytes, formatDateTime } from "@/components/admin/ui";
import { deleteMediaAction, replaceMediaAction, updateMediaAction } from "../actions";

export const metadata = { title: "Media file" };

export default async function MediaDetail({ params }: PageProps<"/admin/media/[id]">) {
  const user = await requirePermission("content.view");
  const { id } = await params;
  const m = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, id) }).catch(() => null);
  if (!m) notFound();
  const usage = await mediaUsage(m.id, m.url);
  const isVideo = m.mimeType.startsWith("video/");
  const canEdit = can(user.role, "media.upload");

  return (
    <>
      <PageHeader
        title={m.filename}
        description={
          <Link href="/admin/media" className="underline">
            ← Media library
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className="admin-card overflow-hidden">
            {isVideo ? (
              <video src={m.url} poster={m.posterUrl ?? undefined} controls preload="metadata" className="max-h-[520px] w-full bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of the original file
              <img src={m.url} alt={m.alt} className="max-h-[520px] w-full bg-[#e9e6e1] object-contain" />
            )}
          </div>
          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-[#6b665e]">Type</dt>
              <dd>{m.mimeType}</dd>
              <dt className="text-[#6b665e]">Size</dt>
              <dd>
                {formatBytes(m.bytes)}
                {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
              </dd>
              <dt className="text-[#6b665e]">Stored on</dt>
              <dd>{m.provider === "cloudinary" ? "Cloudinary" : "Local (development)"}</dd>
              <dt className="text-[#6b665e]">Added</dt>
              <dd>{formatDateTime(m.createdAt)}</dd>
              {m.sourceUrl && (
                <>
                  <dt className="text-[#6b665e]">Migrated from</dt>
                  <dd className="break-all text-xs">{m.sourceUrl}</dd>
                </>
              )}
            </dl>
          </Card>
          <Card title="Where it's used">
            {usage.length === 0 ? (
              <p className="text-sm text-[#6b665e]">Not used anywhere on the site.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {usage.map((u, i) => (
                  <li key={i}>
                    <span className="text-[#6b665e]">{u.kind}:</span>{" "}
                    <Link href={u.href} className="underline">
                      {u.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {m.altStatus === "needs_review" && (
            <Notice>This description was written during the migration and identifies a person or is an inference. Check it, then save.</Notice>
          )}
          <Card title="Description and rights">
            <ActionForm action={updateMediaAction} disabled={!canEdit}>
              <input type="hidden" name="id" value={m.id} />
              <TextArea
                name="alt"
                label={isVideo ? "Description" : "Alt text (what the image shows)"}
                defaultValue={m.alt}
                rows={2}
                maxLength={300}
                hint="Describe what matters, e.g. “Fillet steak sizzling on a hot rock with chips”. Don't start with “Image of”."
              />
              {!isVideo && <Toggle name="decorative" label="Decorative only (no description needed)" />}
              <TextInput name="caption" label="Caption (optional)" defaultValue={m.caption} maxLength={300} hint="Shown in the gallery lightbox." />
              <Select
                name="rightsStatus"
                label="Usage rights"
                defaultValue={m.rightsStatus}
                options={[
                  { value: "cleared", label: "Cleared: we own it or have permission" },
                  { value: "unconfirmed", label: "Unconfirmed: check before launch" },
                  { value: "excluded", label: "Excluded: never show on the site" },
                ]}
              />
              <TextArea name="rightsNote" label="Rights note" defaultValue={m.rightsNote} rows={2} maxLength={500} />
              <div className="flex gap-2">
                {m.altStatus === "ok" ? <Badge tone="good">Description reviewed</Badge> : <Badge tone="warn">Description {m.altStatus === "missing" ? "missing" : "needs review"}</Badge>}
                {m.rightsStatus === "cleared" ? <Badge tone="good">Rights cleared</Badge> : <Badge tone="warn">Rights {m.rightsStatus}</Badge>}
              </div>
            </ActionForm>
          </Card>

          {canEdit && (
            <Card title="Replace file" description="Upload a new version. Every page, menu item and pop-up using this file updates automatically.">
              <ActionForm action={replaceMediaAction} submitLabel="Replace" showCancel={false} compact>
                <input type="hidden" name="id" value={m.id} />
                <input type="file" name="file" accept={isVideo ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/avif"} className="block text-sm" />
              </ActionForm>
            </Card>
          )}
          {can(user.role, "media.delete") && (
            <Card title="Delete">
              {usage.length ? (
                <p className="text-sm text-[#6b665e]">This file is in use and can&apos;t be deleted. Remove it from the places listed first.</p>
              ) : (
                <ConfirmButton action={deleteMediaAction} hidden={{ id: m.id }} label="Delete file" question="Delete this file from the library and storage?" />
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
