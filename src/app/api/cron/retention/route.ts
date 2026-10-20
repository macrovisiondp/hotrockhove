import { NextResponse } from "next/server";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";

/**
 * Daily data-retention job (Vercel Cron, see vercel.json):
 *  - form submissions older than their form's retention period
 *  - newsletter sign-ups never confirmed within 30 days
 *  - expired rate-limit counters
 *  - email log and security audit entries older than 1 year
 * Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const forms = await db.select({ key: t.forms.key, days: t.forms.retentionDays }).from(t.forms).where(isNotNull(t.forms.retentionDays));
  let submissions = 0;
  for (const f of forms) {
    const res = await db
      .delete(t.formSubmissions)
      .where(and(eq(t.formSubmissions.formKey, f.key), lt(t.formSubmissions.createdAt, sql`now() - make_interval(days => ${f.days!})`)))
      .returning({ id: t.formSubmissions.id });
    submissions += res.length;
  }
  const pending = await db
    .delete(t.newsletterSubscribers)
    .where(and(eq(t.newsletterSubscribers.status, "pending"), lt(t.newsletterSubscribers.createdAt, sql`now() - interval '30 days'`)))
    .returning({ id: t.newsletterSubscribers.id });
  await purgeExpiredRateLimits();
  const emails = await db.delete(t.emailLog).where(lt(t.emailLog.createdAt, sql`now() - interval '365 days'`)).returning({ id: t.emailLog.id });
  const security = await db
    .delete(t.auditLogs)
    .where(and(sql`${t.auditLogs.action} like 'security.%'`, lt(t.auditLogs.createdAt, sql`now() - interval '365 days'`)))
    .returning({ id: t.auditLogs.id });

  const summary = { submissions, pendingSubscribers: pending.length, emailLog: emails.length, securityEvents: security.length };
  await audit("retention.purge", { entityType: "system", metadata: summary });
  return NextResponse.json({ ok: true, ...summary });
}
