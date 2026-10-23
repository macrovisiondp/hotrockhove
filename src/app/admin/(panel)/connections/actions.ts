"use server";

import { audit } from "@/lib/audit";
import { failure, guarded, lines, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { getSettingFresh, saveSetting, validateSetting } from "@/lib/settings";
import { invalidate } from "@/domain/content";
import { normalisePhone } from "@/domain/marketing";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms/twilio";

/** Secrets (API keys) belong to the owner's accounts: only owners may change them. */
async function ownerFor(secretChanged: boolean) {
  if (!secretChanged) return true;
  return Boolean(await assertPermission("secrets.edit").catch(() => null));
}

/**
 * Email: Resend API key, sender and the inbox that receives enquiries. Saving with a
 * key and a sender switches sending on straight away.
 */
export async function saveEmailConnectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("email.configure");
    const current = await getSettingFresh("email");
    const newKey = str(fd, "resendApiKey");
    if (!(await ownerFor(Boolean(newKey)))) return failure("Only the owner can change the API key.");
    if (newKey && !/^re_[A-Za-z0-9_]{10,}$/.test(newKey)) return failure("That doesn't look like a Resend API key (it starts with re_).", { resendApiKey: "Check the key" });

    const recipients = lines(fd, "recipients").map((r) => r.toLowerCase());
    const notifications = validateSetting("notifications", { recipients });
    if (!notifications.success) return failure("One of the enquiry addresses isn't a valid email address.", { recipients: "One address per line" });

    const resendApiKey = newKey ? encryptSecret(newKey) : current.resendApiKey;
    const fromAddress = str(fd, "fromAddress").toLowerCase();
    const ready = Boolean(resendApiKey && fromAddress);
    const next = {
      ...current,
      provider: "resend" as const,
      fromName: str(fd, "fromName"),
      fromAddress,
      replyTo: current.replyTo,
      resendApiKey,
      deliveryEnabled: ready,
      ...(newKey || fromAddress !== current.fromAddress ? { lastTestOk: null, lastTestAt: null } : {}),
    };
    const parsed = validateSetting("email", next);
    if (!parsed.success) return zodFailure(parsed.error);

    await saveSetting("email", parsed.data, user.id);
    await saveSetting("notifications", notifications.data, user.id);
    await audit(newKey ? "secret.update" : "settings.update", {
      actorUserId: user.id,
      entityType: "settings",
      entityId: "email",
      metadata: { keyChanged: Boolean(newKey), sending: ready, recipients: recipients.length },
    });
    return success(
      ready
        ? "Saved. Emails are now sent through Resend. Use “Send a test email” to check it arrives."
        : "Saved. Add both the API key and the sender address to start sending emails.",
    );
  });
}

export async function disconnectEmailAction(): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("email.configure");
    if (!(await ownerFor(true))) return failure("Only the owner can remove the API key.");
    const current = await getSettingFresh("email");
    await saveSetting("email", { ...current, resendApiKey: "", deliveryEnabled: false, lastTestOk: null, lastTestAt: null }, user.id);
    await audit("secret.update", { actorUserId: user.id, entityType: "settings", entityId: "email", metadata: { removed: true } });
    return success("Email disconnected. The site no longer sends emails.");
  });
}

/** Cloudflare Turnstile: both keys are needed; the secret is stored encrypted. */
export async function saveTurnstileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const current = await getSettingFresh("turnstile");
    const siteKey = str(fd, "siteKey");
    const newSecret = str(fd, "secretKey");
    if (!(await ownerFor(Boolean(newSecret) || siteKey !== current.siteKey))) return failure("Only the owner can change these keys.");
    const secretKey = newSecret ? encryptSecret(newSecret) : current.secretKey;
    if (siteKey && !secretKey) return failure("Add the secret key as well.", { secretKey: "Required with a site key" });
    if (!siteKey && newSecret) return failure("Add the site key as well.", { siteKey: "Required with a secret key" });
    const parsed = validateSetting("turnstile", { siteKey, secretKey: siteKey ? secretKey : "" });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("turnstile", parsed.data, user.id);
    invalidate("pages");
    await audit("secret.update", { actorUserId: user.id, entityType: "settings", entityId: "turnstile", metadata: { on: Boolean(parsed.data.siteKey) } });
    return success(parsed.data.siteKey ? "Saved. Forms are now protected by Turnstile." : "Saved. Turnstile is off.");
  });
}

/** Booking system link used by every Book Table button. */
export async function saveBookingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const business = await getSettingFresh("business");
    const parsed = validateSetting("business", { ...business, bookTableUrl: str(fd, "bookTableUrl") });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("business", parsed.data, user.id);
    invalidate("pages", "nav");
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "business", metadata: { bookTableUrl: Boolean(parsed.data.bookTableUrl) } });
    return success(parsed.data.bookTableUrl ? "Saved. Book Table buttons now open your booking system." : "Saved. Book Table buttons use the table-request form.");
  });
}

/** Google Analytics 4 measurement ID (loads only for visitors who accept optional cookies). */
export async function saveAnalyticsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const consent = await getSettingFresh("consent");
    const id = str(fd, "analyticsId").toUpperCase();
    if (id && !/^G-[A-Z0-9]{4,20}$/.test(id)) return failure("A Google Analytics measurement ID looks like G-XXXXXXXXXX.", { analyticsId: "Check the ID" });
    const parsed = validateSetting("consent", { ...consent, analyticsProvider: id ? "ga4" : "none", analyticsId: id });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("consent", parsed.data, user.id);
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "consent", metadata: { analytics: parsed.data.analyticsProvider } });
    return success(id ? "Saved. Google Analytics is on for visitors who accept cookies." : "Saved. Google Analytics is off.");
  });
}

/** Twilio (marketing SMS): Account SID, Auth Token (encrypted) and sender. */
export async function saveTwilioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const current = await getSettingFresh("twilio");
    const accountSid = str(fd, "accountSid");
    const newToken = str(fd, "authToken");
    const sender = str(fd, "sender").replace(/\s+(?=\d)/g, "");
    const changed = Boolean(newToken) || accountSid !== current.accountSid || sender !== current.sender;
    if (!(await ownerFor(changed))) return failure("Only the owner can change the Twilio account details.");
    const authToken = newToken ? encryptSecret(newToken) : current.authToken;
    if (newToken && !/^[0-9a-fA-F]{32}$/.test(newToken)) return failure("An Auth Token is 32 letters and digits.", { authToken: "Check the token" });
    const parsed = validateSetting("twilio", { accountSid, authToken: accountSid ? authToken : "", sender, optOutText: str(fd, "optOutText") });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("twilio", parsed.data, user.id);
    await audit(newToken ? "secret.update" : "settings.update", { actorUserId: user.id, entityType: "settings", entityId: "twilio", metadata: { connected: Boolean(parsed.data.accountSid && parsed.data.authToken && parsed.data.sender) } });
    const ready = Boolean(parsed.data.accountSid && parsed.data.authToken && parsed.data.sender);
    return success(ready ? "Saved. Text messages can now be sent. Use “Send a test text” to check." : "Saved. Add the Account SID, Auth Token and sender to start sending texts.");
  });
}

export async function sendTestSmsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.send");
    if (!(await rateLimit(RATE_LIMITS.testEmailPerUser, `sms:${user.id}`)).allowed) return failure("Too many test texts. Wait a few minutes.");
    const to = normalisePhone(str(fd, "to"));
    if (!to) return failure("Enter a mobile number, e.g. 07700 900123.", { to: "Check the number" });
    const business = await getSettingFresh("business");
    const res = await sendSms(to, `Test text from the ${business.name} website admin.`);
    await audit("email.test", { actorUserId: user.id, entityType: "settings", entityId: "twilio", metadata: { ok: res.ok } });
    return res.ok ? { ok: true, message: `Sent to ${to}.`, at: Date.now() } : failure(res.error);
  });
}

export async function disconnectTwilioAction(): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    if (!(await ownerFor(true))) return failure("Only the owner can remove the Twilio details.");
    const current = await getSettingFresh("twilio");
    await saveSetting("twilio", { ...current, accountSid: "", authToken: "", sender: "" }, user.id);
    await audit("secret.update", { actorUserId: user.id, entityType: "settings", entityId: "twilio", metadata: { removed: true } });
    return success("Twilio disconnected. The site no longer sends texts.");
  });
}
