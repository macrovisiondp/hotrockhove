import "server-only";
import { env } from "./env";
import { getSetting, getSettingFresh, revealSecret } from "./settings";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

type Keys = { siteKey: string; secretKey: string; source: "admin" | "environment" | null };

/**
 * Turnstile keys: entered in Admin → Connections (secret encrypted at rest), with the
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY environment variables as a
 * fallback. Both keys are needed; otherwise forms rely on the honeypot and rate limits.
 */
export async function turnstileKeys(fresh = false): Promise<Keys> {
  const s = await (fresh ? getSettingFresh("turnstile") : getSetting("turnstile"));
  const secret = revealSecret(s.secretKey);
  if (s.siteKey && secret) return { siteKey: s.siteKey, secretKey: secret, source: "admin" };
  const e = env();
  if (e.NEXT_PUBLIC_TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY)
    return { siteKey: e.NEXT_PUBLIC_TURNSTILE_SITE_KEY, secretKey: e.TURNSTILE_SECRET_KEY, source: "environment" };
  return { siteKey: "", secretKey: "", source: null };
}

/** Public site key for the form widget, or null when Turnstile isn't set up. */
export async function turnstileSiteKey(): Promise<string | null> {
  const k = await turnstileKeys();
  return k.source ? k.siteKey : null;
}

/**
 * Server-side Turnstile verification. The client widget state is never trusted.
 * When Turnstile is not configured, verification is skipped (honeypot and rate
 * limits still apply).
 */
export async function verifyTurnstile(token: string | null, remoteIp: string | null): Promise<TurnstileResult> {
  const keys = await turnstileKeys();
  if (!keys.source) return { ok: true };
  if (!token || token.length > 2048) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret: keys.secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (!data.success) return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
    return { ok: true };
  } catch {
    return { ok: false, reason: "verify-unavailable" };
  }
}
