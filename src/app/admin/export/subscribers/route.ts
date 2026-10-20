import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { getStaffUser } from "@/lib/session";

/** Confirmed (double opt-in) subscribers only, with their consent record. Owner/admin, audited. */
export async function GET() {
  const user = await getStaffUser();
  if (!user || !can(user.role, "subscribers.manage")) return new Response("Forbidden", { status: 403 });
  const rows = await db
    .select()
    .from(t.newsletterSubscribers)
    .where(eq(t.newsletterSubscribers.status, "subscribed"))
    .orderBy(asc(t.newsletterSubscribers.createdAt));
  const csv = toCsv(
    ["Email", "Confirmed", "Consent given", "Consent wording", "Source"],
    rows.map((r) => [r.email, r.confirmedAt, r.consentAt, r.consentText, r.source]),
  );
  await audit("subscriber.export", { actorUserId: user.id, entityType: "subscriber", metadata: { rows: rows.length } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-confirmed-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
