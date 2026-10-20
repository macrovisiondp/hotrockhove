import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit, clientIp } from "@/lib/audit";
import { hashIdentifier } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { layout } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { getSettingFresh } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT_FIELD, type PublicFormState } from "./forms/submit";

/** Shown beside every sign-up box and stored with each subscription as the consent record. */
export const NEWSLETTER_CONSENT =
  "I'd like to receive emails from Hot Rock Hove about offers and events. I can unsubscribe at any time.";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: tokenHash(token) };
}

/**
 * Double opt-in sign-up. The response is identical whether or not the address
 * is already subscribed, so the form can't be used to discover subscribers.
 */
export async function subscribe(fd: FormData, source: string): Promise<PublicFormState> {
  const done: PublicFormState = {
    status: "success",
    message: "Thanks! Please check your inbox and confirm your subscription.",
    at: Date.now(),
  };

  const trap = fd.get(HONEYPOT_FIELD);
  if (typeof trap === "string" && trap.trim()) {
    await audit("security.honeypot", { entityType: "newsletter" });
    return done;
  }

  const ip = (await clientIp()) ?? "unknown";
  if (!(await rateLimit(RATE_LIMITS.newsletterPerIp, ip)).allowed) {
    await audit("security.rate_limited", { entityType: "newsletter" });
    return { status: "error", message: "Too many attempts. Please try again later.", at: Date.now() };
  }

  const token = fd.get("cf-turnstile-response");
  const ts = await verifyTurnstile(typeof token === "string" ? token : null, ip);
  if (!ts.ok) return { status: "error", message: "We couldn't verify you're human. Please try again.", at: Date.now() };

  if (fd.get("consent") !== "on") {
    return { status: "error", message: "Please tick the box to confirm you'd like to receive emails.", fieldErrors: { consent: "Required" }, at: Date.now() };
  }
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message, fieldErrors: { email: parsed.error.issues[0].message }, at: Date.now() };
  }
  const email = parsed.data;

  const existing = await db.query.newsletterSubscribers.findFirst({ where: eq(t.newsletterSubscribers.email, email) });
  if (existing?.status === "subscribed") return done;

  const { token: raw, hash } = newToken();
  const values = {
    status: "pending" as const,
    source: source.slice(0, 60),
    consentText: NEWSLETTER_CONSENT,
    consentAt: new Date(),
    tokenHash: hash,
    ipHash: hashIdentifier(ip),
    unsubscribedAt: null,
  };
  const [row] = existing
    ? await db.update(t.newsletterSubscribers).set(values).where(eq(t.newsletterSubscribers.id, existing.id)).returning()
    : await db.insert(t.newsletterSubscribers).values({ email, ...values }).returning();

  after(() => sendConfirmation(row.id, email, raw).catch((e) => console.error("[newsletter] confirm email failed:", (e as Error).message)));
  return done;
}

async function sendConfirmation(id: string, email: string, token: string) {
  const business = await getSettingFresh("business");
  const url = `${env().APP_URL}/newsletter/confirm?token=${encodeURIComponent(token)}`;
  const { html, text } = layout({
    brandName: business.name,
    heading: "Please confirm your subscription",
    paragraphs: [
      `You (or someone using your address) asked to receive emails from ${business.name}.`,
      `Confirm your subscription by opening this link:\n${url}`,
      "If you didn't ask for this, ignore this email and you won't hear from us.",
    ],
  });
  await sendEmail(
    { to: [email], subject: `Confirm your ${business.name} subscription`, html, text, idempotencyKey: `newsletter:${id}:confirm:${tokenHash(token).slice(0, 12)}` },
    { template: "newsletter.confirm" },
  );
}

export async function confirmSubscription(token: string): Promise<"confirmed" | "invalid"> {
  if (!token || token.length > 100) return "invalid";
  const row = await db.query.newsletterSubscribers.findFirst({ where: eq(t.newsletterSubscribers.tokenHash, tokenHash(token)) });
  if (!row || row.status === "unsubscribed") return "invalid";
  if (row.status !== "subscribed") {
    await db
      .update(t.newsletterSubscribers)
      .set({ status: "subscribed", confirmedAt: new Date() })
      .where(eq(t.newsletterSubscribers.id, row.id));
  }
  return "confirmed";
}

export async function unsubscribe(token: string): Promise<"unsubscribed" | "invalid"> {
  if (!token || token.length > 100) return "invalid";
  const row = await db.query.newsletterSubscribers.findFirst({ where: eq(t.newsletterSubscribers.tokenHash, tokenHash(token)) });
  if (!row) return "invalid";
  await db
    .update(t.newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(t.newsletterSubscribers.id, row.id));
  return "unsubscribed";
}
