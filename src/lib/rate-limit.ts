import "server-only";
import { lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { hashIdentifier } from "./crypto";

export type RateLimitRule = { name: string; limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  /** Public forms, per client IP. Generous enough for a busy shared network. */
  formPerIp: { name: "form-ip", limit: 10, windowSeconds: 10 * 60 },
  /** Same email submitting the same form repeatedly. */
  formPerEmail: { name: "form-email", limit: 3, windowSeconds: 10 * 60 },
  newsletterPerIp: { name: "news-ip", limit: 10, windowSeconds: 60 * 60 },
  adminSignInPerIp: { name: "signin-ip", limit: 10, windowSeconds: 15 * 60 },
  testEmailPerUser: { name: "test-email", limit: 5, windowSeconds: 10 * 60 },
  popupEventsPerIp: { name: "popup-ip", limit: 60, windowSeconds: 10 * 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window counter stored in Postgres, so limits hold across serverless
 * instances without another service. Identifiers are hashed before storage.
 */
export async function rateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const key = `${rule.name}:${hashIdentifier(identifier)}`;
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000);
  const expiresAt = new Date(windowStart.getTime() + rule.windowSeconds * 1000);

  const [row] = await db
    .insert(t.rateLimits)
    .values({ key, windowStart, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: t.rateLimits.key,
      set: {
        // postgres-js rejects Date objects in raw SQL parameters, so pass ISO text with a cast.
        count: sql`CASE WHEN ${t.rateLimits.windowStart} = ${windowStart.toISOString()}::timestamptz THEN ${t.rateLimits.count} + 1 ELSE 1 END`,
        windowStart,
        expiresAt,
      },
    })
    .returning({ count: t.rateLimits.count });

  const count = row?.count ?? 1;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

export async function purgeExpiredRateLimits() {
  await db.delete(t.rateLimits).where(lt(t.rateLimits.expiresAt, new Date()));
}
