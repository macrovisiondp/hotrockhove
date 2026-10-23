import Link from "next/link";
import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import type { SubscriberStatus } from "@/db/schema";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, InlineAction, Toggle } from "@/components/admin/form";
import { Badge, Card, EmptyState, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";
import { deleteSubscriberAction, importLegacyAction, unsubscribeSubscriberAction } from "./actions";

export const metadata = { title: "Newsletter" };

const LABELS: Record<SubscriberStatus, { label: string; tone: "good" | "warn" | "neutral" | "info" }> = {
  subscribed: { label: "Subscribed", tone: "good" },
  pending: { label: "Awaiting confirmation", tone: "info" },
  unsubscribed: { label: "Unsubscribed", tone: "neutral" },
  legacy_unconfirmed: { label: "Legacy (no consent record)", tone: "warn" },
};

export default async function Newsletter({ searchParams }: PageProps<"/admin/newsletter">) {
  const user = await requirePermission("subscribers.view");
  const sp = await searchParams;
  const status = (Object.keys(LABELS) as SubscriberStatus[]).find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 80) : "";
  const where: SQL[] = [];
  if (status) where.push(eq(t.newsletterSubscribers.status, status));
  if (q) where.push(ilike(t.newsletterSubscribers.email, `%${q}%`));

  const [counts, rows] = await Promise.all([
    db.select({ status: t.newsletterSubscribers.status, n: count() }).from(t.newsletterSubscribers).groupBy(t.newsletterSubscribers.status),
    db
      .select()
      .from(t.newsletterSubscribers)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.newsletterSubscribers.createdAt))
      .limit(200),
  ]);
  const n = (s: SubscriberStatus) => counts.find((c) => c.status === s)?.n ?? 0;
  const canManage = can(user.role, "subscribers.manage");

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="People who asked to receive emails. Sign-ups are confirmed by email (double opt-in) and each one records the consent wording they agreed to."
        actions={
          can(user.role, "subscribers.manage") && (
            <a href="/admin/export/subscribers" download className="admin-btn admin-btn-secondary">
              Export confirmed (CSV)
            </a>
          )
        }
      />
      <Notice tone="info">
        Confirmed subscribers are included automatically when you send an email from{" "}
        <Link href="/admin/marketing" className="underline">
          Marketing
        </Link>
        . Legacy addresses (no consent record) are never included.
      </Notice>

      <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(LABELS) as SubscriberStatus[]).map((s) => (
          <a key={s} href={`?status=${s}`} className="admin-card p-3 hover:border-[#c9c4bb]" aria-current={status === s ? "page" : undefined}>
            <p className="text-xs text-[#6b665e]">{LABELS[s].label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{n(s)}</p>
          </a>
        ))}
      </div>

      <form className="mb-4 flex gap-2" action="/admin/newsletter">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search email" aria-label="Search email" className="admin-input w-64" />
        <button type="submit" className="admin-btn admin-btn-secondary">
          Search
        </button>
        {(status || q) && (
          <Link href="/admin/newsletter" className="admin-btn admin-btn-secondary">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No subscribers yet">Sign-ups from the website appear here.</EmptyState>
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Consent</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f3f1ed] last:border-0">
                  <td className="px-4 py-2.5">{r.email}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={LABELS[r.status].tone}>{LABELS[r.status].label}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6b665e]">{r.source}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6b665e]" title={r.consentText || undefined}>
                    {r.confirmedAt ? `Confirmed ${formatDateTime(r.confirmedAt)}` : r.consentAt ? `Given ${formatDateTime(r.consentAt)}` : "None recorded"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canManage && (
                      <span className="inline-flex gap-2">
                        {r.status !== "unsubscribed" && <InlineAction action={unsubscribeSubscriberAction} hidden={{ id: r.id }} label="Unsubscribe" className="admin-btn admin-btn-secondary min-h-[28px]" />}
                        <ConfirmButton action={deleteSubscriberAction} hidden={{ id: r.id }} label="Erase" question="Erase this address completely?" className="admin-btn admin-btn-danger min-h-[28px]" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {can(user.role, "secrets.edit") && (
        <div className="mt-8">
          <Card
            title="Import the WordPress list (owner only)"
            description="The old site collected about 271 addresses through the 'subscription form' without recording consent wording. Importing keeps them safely here, marked as legacy. Nothing is emailed."
          >
            <ActionForm action={importLegacyAction} submitLabel="Import" showCancel={false} resetOnSuccess compact>
              <label className="block text-sm font-medium">
                CSV exported from WordPress (Forms → subscription form → Export entries)
                <input type="file" name="file" accept=".csv,text/csv" className="mt-1.5 block text-sm" />
              </label>
              <Toggle
                name="acknowledge"
                label="I understand these addresses must not be sent marketing emails until a re-permission decision has been made."
              />
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
