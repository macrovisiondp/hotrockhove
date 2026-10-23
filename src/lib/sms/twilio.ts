import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSettingFresh, revealSecret, type TwilioSettings } from "@/lib/settings";

export type SmsResult = { ok: true; id: string } | { ok: false; error: string };

export function twilioReady(s: TwilioSettings): boolean {
  return Boolean(s.accountSid && s.authToken && s.sender);
}

/** Send one SMS through Twilio's REST API. Never throws. */
export async function sendSms(to: string, body: string, settings?: TwilioSettings): Promise<SmsResult> {
  const s = settings ?? (await getSettingFresh("twilio"));
  if (!twilioReady(s)) return { ok: false, error: "Twilio isn't connected (Admin → Connections)." };
  const token = revealSecret(s.authToken);
  const form = new URLSearchParams({ To: to, Body: body });
  if (s.sender.startsWith("MG")) form.set("MessagingServiceSid", s.sender);
  else form.set("From", s.sender);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${s.accountSid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok || !data.sid) {
      if (res.status === 401) return { ok: false, error: "Twilio rejected the Account SID or Auth Token." };
      return { ok: false, error: `Twilio${data.code ? ` ${data.code}` : ""}: ${data.message ?? `HTTP ${res.status}`}`.slice(0, 300) };
    }
    return { ok: true, id: data.sid };
  } catch (err) {
    return { ok: false, error: `Couldn't reach Twilio: ${(err as Error).message}`.slice(0, 300) };
  }
}

/**
 * Validate X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export { smsSegments } from "./segments";
