import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { parseSections } from "@/domain/sections";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, InlineAction, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { MediaField } from "@/components/admin/media-picker";
import { SectionEditor } from "@/components/admin/section-editor";
import { Badge, Card, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";
import { deletePageAction, restoreRevisionAction, savePageAction, setPageStatusAction } from "../actions";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  const user = await requirePermission("content.view");
  const { id } = await params;
  const page = await db.query.pages.findFirst({ where: eq(t.pages.id, id) }).catch(() => null);
  if (!page) notFound();
  const [forms, revisions] = await Promise.all([
    db.select({ key: t.forms.key, name: t.forms.name }).from(t.forms).orderBy(asc(t.forms.name)),
    db
      .select({ id: t.pageRevisions.id, createdAt: t.pageRevisions.createdAt, who: t.users.name })
      .from(t.pageRevisions)
      .leftJoin(t.users, eq(t.users.id, t.pageRevisions.createdById))
      .where(eq(t.pageRevisions.pageId, page.id))
      .orderBy(desc(t.pageRevisions.createdAt))
      .limit(10),
  ]);
  const { sections, invalid } = parseSections(page.sections);
  const canEdit = can(user.role, "content.edit");
  const canPublish = can(user.role, "content.publish");
  const path = page.slug ? `/${page.slug}` : "/";

  return (
    <>
      <PageHeader
        title={page.title}
        description={
          <>
            <Link href="/admin/pages" className="underline">
              ← All pages
            </Link>{" "}
            · {path} · {page.status === "published" ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}
          </>
        }
        actions={
          <>
            <Link href={`/admin/preview/${page.id}`} target="_blank" className="admin-btn admin-btn-secondary">
              Preview
            </Link>
            {page.status === "published" && (
              <Link href={path} target="_blank" className="admin-btn admin-btn-secondary">
                View live
              </Link>
            )}
            {canPublish && (
              <InlineAction
                action={setPageStatusAction}
                hidden={{ id: page.id, status: page.status === "published" ? "draft" : "published" }}
                label={page.status === "published" ? "Unpublish" : "Publish"}
                className={page.status === "published" ? "admin-btn admin-btn-secondary" : "admin-btn admin-btn-primary"}
              />
            )}
          </>
        }
      />
      {page.reviewNote && (
        <div className="mb-4">
          <Notice>
            <strong>Review note:</strong> {page.reviewNote}
          </Notice>
        </div>
      )}
      {invalid > 0 && (
        <div className="mb-4">
          <Notice tone="bad">{invalid} section(s) couldn&apos;t be read and are not shown. Saving will remove them.</Notice>
        </div>
      )}

      <ActionForm action={savePageAction} disabled={!canEdit}>
        <input type="hidden" name="id" value={page.id} />
        <Card title="Page">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="title" label="Title" defaultValue={page.title} required maxLength={120} hint="Used in the browser tab and as the heading when the first section has none." />
            {page.system ? (
              <div>
                <p className="mb-1.5 text-sm font-medium">Address</p>
                <p className="text-sm text-[#6b665e]">{path} (fixed: this page is part of the site structure)</p>
              </div>
            ) : (
              <TextInput name="slug" label="Address" defaultValue={page.slug} hint="Changing a live page's address adds a redirect from the old one." />
            )}
          </div>
        </Card>

        <Card title="Content" description="Click a section to edit it. Use the arrows to reorder and the eye to hide a section without deleting it.">
          <SectionEditor initial={sections} forms={forms} />
        </Card>

        <Card title="Search & sharing">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="seoTitle" label="SEO title" defaultValue={page.seoTitle} maxLength={70} hint="Shown in Google results. Falls back to the page title." />
            <TextInput name="canonicalUrl" label="Canonical URL (advanced)" defaultValue={page.canonicalUrl} placeholder="Leave empty" />
          </div>
          <TextArea name="seoDescription" label="Meta description" defaultValue={page.seoDescription} rows={2} maxLength={200} wrapClass="mt-4" hint="One or two sentences, under 160 characters ideally." />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MediaField name="ogImageId" label="Social sharing image" defaultId={page.ogImageId} type="image" hint="Used when the page is shared on social media. 1200×630 works best." />
            <div className="space-y-3">
              <Toggle name="noindex" label="Hide from search engines" defaultChecked={page.noindex} />
              {page.reviewNote && <Toggle name="clearReviewNote" label="Mark as reviewed (clears the review note)" />}
            </div>
          </div>
        </Card>
      </ActionForm>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card title="Revisions" description="A copy is kept each time the page is saved (last 20).">
          {revisions.length === 0 ? (
            <p className="text-sm text-[#6b665e]">No earlier versions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span>
                    {formatDateTime(r.createdAt)} <span className="text-xs text-[#8a847b]">{r.who ?? ""}</span>
                  </span>
                  {canEdit && <InlineAction action={restoreRevisionAction} hidden={{ revisionId: r.id }} label="Restore" className="admin-btn admin-btn-secondary min-h-[28px]" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {!page.system && can(user.role, "content.delete") && (
          <Card title="Delete page">
            <p className="mb-3 text-sm text-[#6b665e]">Deleting removes the page and its revisions. Consider unpublishing instead.</p>
            <ConfirmButton action={deletePageAction} hidden={{ id: page.id }} label="Delete page" question={`Delete "${page.title}" permanently?`} />
          </Card>
        )}
      </div>
    </>
  );
}
