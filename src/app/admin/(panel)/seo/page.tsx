import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { ActionForm, ConfirmButton, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader } from "@/components/admin/ui";
import { deleteRedirectAction, saveRedirectAction, saveSeoAction } from "./actions";

export const metadata = { title: "SEO & redirects" };

const CODES = [
  { value: "301", label: "301 Moved permanently" },
  { value: "302", label: "302 Temporary" },
  { value: "410", label: "410 Gone (removed)" },
];

export default async function Seo() {
  const user = await requirePermission("settings.view");
  const [seo, redirects] = await Promise.all([getSettingFresh("seo"), db.select().from(t.redirects).orderBy(asc(t.redirects.fromPath))]);
  const canSeo = can(user.role, "seo.edit");
  const canRedirects = can(user.role, "redirects.edit");

  return (
    <>
      <PageHeader title="SEO & redirects" description="How the site appears in search results, and what happens to old WordPress addresses." />
      <div className="space-y-6">
        <Card title="Search defaults">
          <ActionForm action={saveSeoAction} disabled={!canSeo}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="siteTitle" label="Site title" defaultValue={seo.siteTitle} maxLength={70} />
              <TextInput name="titleTemplate" label="Page title pattern" defaultValue={seo.titleTemplate} hint="%s is replaced by the page title." />
            </div>
            <TextArea name="defaultDescription" label="Default description" defaultValue={seo.defaultDescription} rows={2} maxLength={200} />
            <TextInput name="defaultOgImage" label="Default sharing image URL" defaultValue={seo.defaultOgImage} hint="Copy an image URL from Media (Cloudinary) or use /brand/…" />
            <div className="rounded-md border border-[#e6e3de] bg-[#faf9f7] p-4">
              <Toggle
                name="allowIndexing"
                label="Allow search engines to index the site"
                hint="Leave off until launch. When off, every page is 'noindex', robots.txt blocks crawling and the sitemap is empty. Preview deployments never index."
                defaultChecked={seo.allowIndexing}
              />
            </div>
          </ActionForm>
        </Card>

        <Card
          title="Redirects"
          description="Old addresses from the WordPress site and their new destinations. Changes apply within a minute. 'Include sub-pages' also matches everything below the address."
        >
          <Notice tone="info">
            The old site&apos;s SEO plugin (Rank Math) redirect list couldn&apos;t be checked during the audit. If Google Search Console reports 404s for old
            addresses after launch, add them here.
          </Notice>
          <ul className="mt-4 space-y-3">
            {redirects.map((r) => (
              <li key={r.id} className="rounded-md border border-[#ece9e4] p-3">
                <ActionForm action={saveRedirectAction} disabled={!canRedirects} compact submitLabel="Save">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_200px]">
                    <TextInput name="fromPath" label="Old address" defaultValue={r.fromPath} />
                    <TextInput name="toPath" label="Goes to" defaultValue={r.toPath} placeholder={r.statusCode === 410 ? "(removed)" : ""} />
                    <Select name="statusCode" label="Type" defaultValue={String(r.statusCode)} options={CODES} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Toggle name="prefix" label="Include sub-pages" defaultChecked={r.prefix} />
                    <Toggle name="enabled" label="Enabled" defaultChecked={r.enabled} />
                    <span className="text-xs text-[#6b665e]">{r.note}</span>
                    <input type="hidden" name="note" value={r.note} />
                    {!r.enabled && <Badge>Off</Badge>}
                  </div>
                </ActionForm>
                {canRedirects && (
                  <div className="mt-2">
                    <ConfirmButton action={deleteRedirectAction} hidden={{ id: r.id }} label="Delete" question="Delete this redirect?" className="admin-btn admin-btn-danger min-h-[28px]" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canRedirects && (
            <div className="mt-4 rounded-md bg-[#f3f1ed] p-3">
              <ActionForm action={saveRedirectAction} compact submitLabel="Add redirect" resetOnSuccess showCancel={false}>
                <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_200px]">
                  <TextInput name="fromPath" label="Old address" placeholder="/old-page" />
                  <TextInput name="toPath" label="Goes to" placeholder="/new-page" />
                  <Select name="statusCode" label="Type" defaultValue="301" options={CODES} />
                </div>
                <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
                  <Toggle name="prefix" label="Include sub-pages" />
                  <TextInput name="note" label="Note (optional)" maxLength={200} />
                </div>
              </ActionForm>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
