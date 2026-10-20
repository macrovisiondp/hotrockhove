import Link from "next/link";
import { desc, gt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { Badge, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";

export const metadata = { title: "Pop-ups" };

export default async function Popups() {
  const user = await requirePermission("content.view");
  const [rows, stats] = await Promise.all([
    db.select().from(t.popups).orderBy(desc(t.popups.priority)),
    db
      .select({
        popupId: t.popupStats.popupId,
        impressions: sql<number>`sum(${t.popupStats.impressions})`,
        dismissals: sql<number>`sum(${t.popupStats.dismissals})`,
        conversions: sql<number>`sum(${t.popupStats.conversions})`,
      })
      .from(t.popupStats)
      .where(gt(t.popupStats.day, sql`(current_date - 30)`))
      .groupBy(t.popupStats.popupId),
  ]);
  // Server component: evaluated once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Pop-ups"
        description="Promotions that appear over a page. Only one pop-up shows per visit, never on top of the cookie banner, and each visitor sees it at most as often as its frequency allows."
        actions={
          can(user.role, "popups.edit") && (
            <Link href="/admin/popups/new" className="admin-btn admin-btn-primary">
              New pop-up
            </Link>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No pop-ups" />
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const s = stats.find((x) => x.popupId === p.id);
            const scheduled = p.startsAt && new Date(p.startsAt).getTime() > now;
            const ended = p.endsAt && new Date(p.endsAt).getTime() < now;
            return (
              <li key={p.id} className="admin-card flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link href={`/admin/popups/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>{" "}
                  {!p.enabled ? <Badge>Off</Badge> : ended ? <Badge tone="warn">Ended</Badge> : scheduled ? <Badge tone="info">Scheduled</Badge> : <Badge tone="good">Live</Badge>}
                  <p className="text-xs text-[#6b665e]">
                    {p.pages.length ? p.pages.join(", ") : "All pages"} ·{" "}
                    {p.trigger === "delay" ? `after ${p.delaySeconds}s` : p.trigger === "scroll" ? `at ${p.scrollPercent}% scroll` : "exit intent (desktop)"} ·{" "}
                    {p.frequency === "session" ? "once per visit" : p.frequency === "once" ? "once ever" : `every ${p.frequencyDays} days`}
                    {p.startsAt && ` · from ${formatDateTime(p.startsAt)}`}
                    {p.endsAt && ` · until ${formatDateTime(p.endsAt)}`}
                  </p>
                </div>
                <dl className="flex gap-5 text-center text-xs text-[#6b665e]">
                  {[
                    ["Shown", s?.impressions],
                    ["Closed", s?.dismissals],
                    ["Converted", s?.conversions],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dd className="text-base font-semibold tabular-nums text-[#1c1b19]">{Number(v ?? 0)}</dd>
                      <dt>{k} (30d)</dt>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
