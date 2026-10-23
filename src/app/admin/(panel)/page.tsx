import Link from "next/link";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { turnstileKeys } from "@/lib/turnstile";
import { Badge, Card, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const [email, business, consent, ts] = await Promise.all([getSettingFresh("email"), getSettingFresh("business"), getSettingFresh("consent"), turnstileKeys(true)]);
  const connections = [
    { label: "Email (Resend)", on: email.deliveryEnabled && Boolean(email.resendApiKey && email.fromAddress) },
    { label: "Spam protection (Turnstile)", on: Boolean(ts.source) },
    { label: "Booking system", on: Boolean(business.bookTableUrl) },
    { label: "Google Analytics", on: consent.analyticsProvider === "ga4" && Boolean(consent.analyticsId) },
  ];

  const [[newSubs], [subscribers], [emailFailed], [published], [drafts], [popups], [media], [marketing]] = await Promise.all([
    db.select({ n: count() }).from(t.formSubmissions).where(eq(t.formSubmissions.status, "new")),
    db.select({ n: count() }).from(t.newsletterSubscribers).where(eq(t.newsletterSubscribers.status, "subscribed")),
    db
      .select({ n: count() })
      .from(t.emailLog)
      .where(and(eq(t.emailLog.status, "failed"), gt(t.emailLog.createdAt, sql`now() - interval '7 days'`))),
    db.select({ n: count() }).from(t.pages).where(eq(t.pages.status, "published")),
    db.select({ n: count() }).from(t.pages).where(eq(t.pages.status, "draft")),
    db.select({ n: count() }).from(t.popups).where(eq(t.popups.enabled, true)),
    db.select({ n: count(), bytes: sql<number>`coalesce(sum(${t.mediaAssets.bytes}), 0)` }).from(t.mediaAssets),
    db.select({ n: count() }).from(t.marketingContacts),
  ]);

  const canSubs = can(user.role, "submissions.view");
  const recent = canSubs
    ? await db
        .select({ id: t.formSubmissions.id, formKey: t.formSubmissions.formKey, createdAt: t.formSubmissions.createdAt, status: t.formSubmissions.status, name: t.forms.name })
        .from(t.formSubmissions)
        .innerJoin(t.forms, eq(t.forms.key, t.formSubmissions.formKey))
        .orderBy(desc(t.formSubmissions.createdAt))
        .limit(6)
    : [];
  const activity = can(user.role, "audit.view")
    ? await db
        .select({ id: t.auditLogs.id, action: t.auditLogs.action, createdAt: t.auditLogs.createdAt, who: t.users.name })
        .from(t.auditLogs)
        .leftJoin(t.users, eq(t.users.id, t.auditLogs.actorUserId))
        .where(sql`${t.auditLogs.action} not like 'security.%'`)
        .orderBy(desc(t.auditLogs.createdAt))
        .limit(8)
    : [];

  const stats = [
    { label: "New submissions", value: newSubs.n, href: canSubs ? "/admin/submissions?status=new" : undefined },
    { label: "Newsletter subscribers", value: subscribers.n, href: "/admin/newsletter", note: "confirmed" },
    { label: "Email failures (7 days)", value: emailFailed.n, href: "/admin/email#log" },
    { label: "Pages", value: `${published.n} live`, note: `${drafts.n} draft`, href: "/admin/pages" },
    { label: "Active pop-ups", value: popups.n, href: "/admin/popups" },
    { label: "Media", value: media.n, note: `${(Number(media.bytes) / 1024 / 1024).toFixed(0)} MB`, href: "/admin/media" },
    ...(can(user.role, "marketing.view")
      ? [{ label: "Marketing contacts", value: marketing.n, note: "uploaded / added", href: "/admin/marketing" }]
      : []),
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      {sp.error === "forbidden" && (
        <div className="mb-4">
          <Notice tone="bad">You don&apos;t have permission to open that page.</Notice>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => {
          const inner = (
            <>
              <p className="text-xs text-[#6b665e]">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
              {s.note && <p className="text-xs text-[#8a847b]">{s.note}</p>}
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="admin-card p-3 hover:border-[#c9c4bb]">
              {inner}
            </Link>
          ) : (
            <div key={s.label} className="admin-card p-3">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Connections" description="Services the website uses. Set them up under Connections.">
          <ul className="divide-y divide-[#f0ede8]">
            {connections.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{c.label}</span>
                {c.on ? <Badge tone="good">Connected</Badge> : <Badge tone="neutral">Not connected</Badge>}
              </li>
            ))}
          </ul>
          <Link href="/admin/connections" className="admin-btn admin-btn-secondary mt-4 inline-flex">
            Open Connections
          </Link>
        </Card>

        <div className="space-y-6">
          {canSubs && (
            <Card title="Recent submissions">
              {recent.length === 0 ? (
                <p className="text-sm text-[#6b665e]">No submissions yet.</p>
              ) : (
                <ul className="divide-y divide-[#f0ede8] text-sm">
                  {recent.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/admin/submissions/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-[#6b665e]">
                        {r.status === "new" && <Badge tone="info">New</Badge>}
                        {formatDateTime(r.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {activity.length > 0 && (
            <Card title="Recent admin activity">
              <ul className="space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium">{a.who ?? "System"}</span> <span className="text-[#6b665e]">{a.action.replace(/[._]/g, " ")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-[#8a847b]">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/activity" className="mt-3 inline-block text-xs underline">
                Full activity log
              </Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
