import "server-only";
import { headers } from "next/headers";
import { db, t } from "@/db";
import { hashIdentifier } from "./crypto";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_in_failed"
  | "auth.password_changed"
  | "settings.update"
  | "secret.update"
  | "secret.delete"
  | "page.create"
  | "page.update"
  | "page.publish"
  | "page.unpublish"
  | "page.delete"
  | "nav.update"
  | "redirect.create"
  | "redirect.update"
  | "redirect.delete"
  | "menu.category_save"
  | "menu.category_delete"
  | "menu.item_save"
  | "menu.item_delete"
  | "offer.save"
  | "offer.delete"
  | "media.upload"
  | "media.update"
  | "media.replace"
  | "media.delete"
  | "form.update"
  | "submission.status"
  | "submission.delete"
  | "submission.export"
  | "subscriber.update"
  | "subscriber.delete"
  | "subscriber.export"
  | "popup.save"
  | "popup.delete"
  | "email.test"
  | "user.create"
  | "user.update"
  | "retention.purge"
  | "security.turnstile_failed"
  | "security.rate_limited"
  | "security.honeypot";

/** Client IP as reported by Vercel / Cloudflare. Used only transiently or hashed. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/**
 * Record an administrative or security event. Metadata must not contain
 * passwords, API keys or submission contents.
 */
export async function audit(
  action: AuditAction,
  opts: { actorUserId?: string | null; entityType?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
) {
  try {
    const ip = await clientIp().catch(() => null);
    await db.insert(t.auditLogs).values({
      action,
      actorUserId: opts.actorUserId ?? null,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      metadata: opts.metadata ?? {},
      ipHash: ip ? hashIdentifier(ip) : null,
    });
  } catch (err) {
    // Auditing must never break the user flow; log without payload.
    console.error(`[audit] failed to record ${action}:`, (err as Error).message);
  }
}
