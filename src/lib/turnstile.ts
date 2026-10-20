import "server-only";
import { env, turnstileConfigured } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

/**
 * Server-side Turnstile verification. The client widget state is never trusted.
 * When Turnstile is not configured, verification is skipped (honeypot and rate
 * limits still apply) and the admin dashboard reports it as a launch blocker.
 */
export async function verifyTurnstile(token: string | null, remoteIp: string | null): Promise<TurnstileResult> {
  if (!turnstileConfigured()) return { ok: true };
  if (!token || token.length > 2048) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET_KEY!, response: token });
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
