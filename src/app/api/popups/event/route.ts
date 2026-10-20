import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { clientIp } from "@/lib/audit";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

const body = z.object({ id: z.string().uuid(), type: z.enum(["impression", "dismiss", "convert"]) });

/**
 * Anonymous pop-up counters (daily aggregates only; no cookies, no identifiers stored).
 * Always answers 204 so it can't be used to probe pop-up ids.
 */
export async function POST(req: Request) {
  const ok = new NextResponse(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (text.length > 200) return ok;
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(text));
  } catch {
    return ok;
  }
  if (!parsed.success) return ok;
  const ip = (await clientIp()) ?? "unknown";
  if (!(await rateLimit(RATE_LIMITS.popupEventsPerIp, ip)).allowed) return ok;

  const { id, type } = parsed.data;
  const day = new Date().toISOString().slice(0, 10);
  const col = type === "impression" ? "impressions" : type === "dismiss" ? "dismissals" : "conversions";
  try {
    await db
      .insert(t.popupStats)
      .values({ popupId: id, day, [col]: 1 })
      .onConflictDoUpdate({
        target: [t.popupStats.popupId, t.popupStats.day],
        set: { [col]: sql`${t.popupStats[col]} + 1` },
      });
  } catch {
    // Unknown popup id (foreign key) or transient error: ignore.
  }
  return ok;
}
