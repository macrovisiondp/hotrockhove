import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { Badge, EmptyState, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Offers" };

export default async function Offers() {
  const user = await requirePermission("content.view");
  const rows = await db.select().from(t.offers).orderBy(asc(t.offers.sortOrder));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader
        title="Offers"
        description="Weekly deals and promotions shown wherever a page has an Offers section (currently Daisy's Offers). Offers with dates appear and disappear automatically."
        actions={
          can(user.role, "content.edit") && (
            <Link href="/admin/offers/new" className="admin-btn admin-btn-primary">
              New offer
            </Link>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No offers" />
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => {
            const expired = o.endsOn && o.endsOn < today;
            const future = o.startsOn && o.startsOn > today;
            return (
              <li key={o.id} className="admin-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/admin/offers/${o.id}`} className="font-medium hover:underline">
                    {o.title}
                  </Link>{" "}
                  {o.status === "draft" ? <Badge>Draft</Badge> : expired ? <Badge tone="warn">Ended</Badge> : future ? <Badge tone="info">Scheduled</Badge> : <Badge tone="good">Live</Badge>}{" "}
                  {o.stage === "upcoming" && <Badge tone="info">Coming soon</Badge>} {o.reviewNote && <Badge tone="warn">Review</Badge>}
                  <p className="text-xs text-[#6b665e]">
                    {[o.priceText, o.promoCode && `code ${o.promoCode}`, o.startsOn && `from ${o.startsOn}`, o.endsOn && `until ${o.endsOn}`].filter(Boolean).join(" · ") || o.tagline}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
