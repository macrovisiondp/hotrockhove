import { setSmsConsent } from "@/domain/marketing";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { getSettingFresh, revealSecret } from "@/lib/settings";
import { validTwilioSignature } from "@/lib/sms/twilio";

const STOP = /^(stop|stopall|unsubscribe|cancel|end|quit|optout|opt out)$/i;
const START = /^(start|unstop|yes)$/i;
const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * Twilio "A message comes in" webhook. Records STOP / START replies to marketing
 * texts. Requests are verified with Twilio's signature (HMAC of URL + params).
 */
export async function POST(req: Request) {
  const s = await getSettingFresh("twilio");
  const token = revealSecret(s.authToken);
  if (!token) return new Response("Not configured", { status: 404 });

  const params = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const url = `${env().APP_URL}/api/twilio/inbound`;
  const forwarded = `${new URL(req.url).origin}/api/twilio/inbound`;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  if (!validTwilioSignature(token, url, params, sig) && !validTwilioSignature(token, forwarded, params, sig)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const body = (params.Body ?? "").trim();
  const from = params.From ?? "";
  if (from && (STOP.test(body) || START.test(body))) {
    const subscribed = START.test(body);
    const n = await setSmsConsent(from, subscribed);
    await audit("settings.update", { entityType: "marketing", entityId: "sms-consent", metadata: { action: subscribed ? "start" : "stop", matched: n } });
  }
  return new Response(TWIML, { headers: { "Content-Type": "text/xml" } });
}
