import Link from "next/link";
import { and, count, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, InlineAction, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { Badge, Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { addContactAction, deleteContactAction, unsubscribeContactAction, uploadContactsAction } from "../actions";

export const metadata = { title: "Marketing contacts" };

const CONSENT_LABEL = "These people agreed to receive marketing from us by email and/or text, and haven't asked us to stop.";

export default async function Contacts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("marketing.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 80) : "";
  const filter = typeof sp.f === "string" ? sp.f : "";
  const where: SQL[] = [];
  if (q) where.push(or(ilike(t.marketingContacts.email, `%${q}%`), ilike(t.marketingContacts.phone, `%${q.replace(/\s/g, "")}%`), ilike(t.marketingContacts.name, `%${q}%`))!);
  if (filter === "email") where.push(and(isNotNull(t.marketingContacts.email), eq(t.marketingContacts.emailStatus, "subscribed"))!);
  if (filter === "sms") where.push(and(isNotNull(t.marketingContacts.phone), eq(t.marketingContacts.smsStatus, "subscribed"))!);
  if (filter === "unsubscribed") where.push(or(eq(t.marketingContacts.emailStatus, "unsubscribed"), eq(t.marketingContacts.smsStatus, "unsubscribed"))!);

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(t.marketingContacts),
    db
      .select()
      .from(t.marketingContacts)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.marketingContacts.createdAt))
      .limit(300),
  ]);
  const canManage = can(user.role, "marketing.manage");
  const tabs = [
    ["", "All"],
    ["email", "Emails"],
    ["sms", "Texts"],
    ["unsubscribed", "Unsubscribed"],
  ] as const;

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${total} contact(s) you've uploaded or added. Newsletter subscribers from the website are included in emails automatically and are listed under Newsletter.`}
        actions={
          <Link href="/admin/marketing" className="admin-btn admin-btn-secondary">
            Back to Marketing
          </Link>
        }
      />

      {canManage && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Card title="Upload contacts" description="A CSV file with columns such as name, email, phone (save Excel sheets as CSV), or paste one contact per line.">
            <ActionForm action={uploadContactsAction} submitLabel="Upload" showCancel={false} resetOnSuccess compact>
              <label className="block text-sm font-medium">
                CSV or text file
                <input type="file" name="file" accept=".csv,.txt,text/csv,text/plain" className="mt-1.5 block text-sm" />
              </label>
              <TextArea name="pasted" label="…or paste contacts" rows={4} placeholder={"Jane Smith, jane@example.com, 07700 900123\nsam@example.com\n07700 900456"} />
              <TextInput name="consentNote" label="How did they agree?" placeholder="e.g. Signed up at the restaurant, 2026" maxLength={300} />
              <Toggle name="consent" label={CONSENT_LABEL} />
              <p className="text-xs text-[#6b665e]">UK mobile numbers can start 07 or +44. Anyone who has unsubscribed before stays unsubscribed.</p>
            </ActionForm>
          </Card>
          <Card title="Add a contact">
            <ActionForm action={addContactAction} submitLabel="Add" showCancel={false} resetOnSuccess compact>
              <TextInput name="name" label="Name (optional)" maxLength={120} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput name="email" label="Email" type="email" />
                <TextInput name="phone" label="Mobile" type="tel" placeholder="07700 900123" />
              </div>
              <TextInput name="consentNote" label="How did they agree? (optional)" maxLength={300} />
              <Toggle name="consent" label="This person agreed to receive marketing from us." />
            </ActionForm>
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([v, label]) => (
          <Link
            key={v}
            href={`?${new URLSearchParams({ ...(v ? { f: v } : {}), ...(q ? { q } : {}) })}`}
            aria-current={filter === v ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${filter === v ? "border-[#1c1b19] bg-[#1c1b19] text-white" : "border-[#d6d3cd]"}`}
          >
            {label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/marketing/contacts">
          {filter && <input type="hidden" name="f" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Search name, email or number" aria-label="Search contacts" className="admin-input w-64" />
          <button type="submit" className="admin-btn admin-btn-secondary">
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={total ? "No contacts match" : "No contacts yet"}>{total ? "Try another search." : "Upload a list or add a contact above."}</EmptyState>
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Mobile</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f3f1ed] last:border-0">
                  <td className="px-4 py-2.5">{r.name || <span className="text-[#8a847b]">—</span>}</td>
                  <td className="px-4 py-2.5">
                    {r.email ? (
                      <span className="inline-flex items-center gap-2">
                        {r.email}
                        {r.emailStatus === "unsubscribed" && <Badge tone="neutral">Unsubscribed</Badge>}
                      </span>
                    ) : (
                      <span className="text-[#8a847b]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {r.phone ? (
                      <span className="inline-flex items-center gap-2">
                        {r.phone}
                        {r.smsStatus === "unsubscribed" && <Badge tone="neutral">Unsubscribed</Badge>}
                      </span>
                    ) : (
                      <span className="text-[#8a847b]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6b665e]" title={r.consentNote || undefined}>
                    {formatDateTime(r.createdAt)}
                    <br />
                    {r.source}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canManage && (
                      <span className="inline-flex flex-wrap justify-end gap-2">
                        {r.email && r.emailStatus === "subscribed" && (
                          <InlineAction action={unsubscribeContactAction} hidden={{ id: r.id, channel: "email" }} label="Stop emails" className="admin-btn admin-btn-secondary min-h-[28px]" />
                        )}
                        {r.phone && r.smsStatus === "subscribed" && (
                          <InlineAction action={unsubscribeContactAction} hidden={{ id: r.id, channel: "sms" }} label="Stop texts" className="admin-btn admin-btn-secondary min-h-[28px]" />
                        )}
                        <ConfirmButton action={deleteContactAction} hidden={{ id: r.id }} label="Erase" question="Erase this contact completely?" className="admin-btn admin-btn-danger min-h-[28px]" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
