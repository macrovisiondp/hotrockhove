"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, int, lines, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { sendEmail } from "@/lib/email";
import { layout } from "@/lib/email/templates";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { assertPermission } from "@/lib/session";
import { getSettingFresh, mergeSecret, saveSetting, validateSetting } from "@/lib/settings";

export async function saveRecipientsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("email.configure");
    const recipients = lines(fd, "recipients").map((r) => r.toLowerCase());
    const parsed = validateSetting("notifications", { recipients });
    if (!parsed.success) return failure("One of the addresses isn't a valid email address.", { recipients: "Check each address (one per line)." });
    await saveSetting("notifications", parsed.data, user.id);
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "notifications", metadata: { count: recipients.length } });
    return success(recipients.length ? `Notifications will go to ${recipients.join(", ")}.` : "Saved. No recipients: staff won't be notified of new submissions.");
  });
}

export async function saveEmailAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("email.configure");
    const current = await getSettingFresh("email");
    const newKey = str(fd, "resendApiKey");
    const newSmtpPassword = str(fd, "smtpPassword");
    const touchesSecrets = Boolean(newKey || newSmtpPassword || bool(fd, "clearResendKey") || bool(fd, "clearSmtpPassword"));
    // Provider credentials belong to the owner's accounts: only owners may change them.
    if (touchesSecrets) {
      const owner = await assertPermission("secrets.edit").catch(() => null);
      if (!owner) return failure("Only the owner can change API keys or passwords.");
    }
    if (newKey && !/^re_[A-Za-z0-9_]{10,}$/.test(newKey)) return failure("That doesn't look like a Resend API key (it starts with re_).", { resendApiKey: "Invalid key format" });

    const next = {
      ...current,
      provider: str(fd, "provider") as "resend" | "smtp" | "none",
      fromName: str(fd, "fromName"),
      fromAddress: str(fd, "fromAddress").toLowerCase(),
      replyTo: str(fd, "replyTo").toLowerCase(),
      resendApiKey: bool(fd, "clearResendKey") ? "" : mergeSecret(current.resendApiKey, newKey),
      smtp: {
        host: str(fd, "smtpHost"),
        port: int(fd, "smtpPort", 587),
        secure: bool(fd, "smtpSecure"),
        user: str(fd, "smtpUser"),
        password: bool(fd, "clearSmtpPassword") ? "" : mergeSecret(current.smtp.password, newSmtpPassword),
      },
      deliveryEnabled: bool(fd, "deliveryEnabled"),
    };
    // A changed provider, sender or key needs a fresh successful test.
    if (next.provider !== current.provider || next.fromAddress !== current.fromAddress || newKey || newSmtpPassword) {
      next.lastTestOk = null;
      next.lastTestAt = null;
    }
    const parsed = validateSetting("email", next);
    if (!parsed.success) return zodFailure(parsed.error);
    if (parsed.data.deliveryEnabled && !parsed.data.fromAddress) return failure("Set a sender address before switching delivery on.", { fromAddress: "Required to send email" });

    await saveSetting("email", parsed.data, user.id);
    await audit(touchesSecrets ? "secret.update" : "settings.update", {
      actorUserId: user.id,
      entityType: "settings",
      entityId: "email",
      metadata: { provider: parsed.data.provider, deliveryEnabled: parsed.data.deliveryEnabled, keyChanged: Boolean(newKey), smtpPasswordChanged: Boolean(newSmtpPassword) },
    });
    return success(
      parsed.data.deliveryEnabled
        ? "Saved. Email delivery is ON."
        : "Saved. Email delivery is OFF: no notifications or acknowledgements will be sent until you switch it on.",
    );
  });
}

const testSchema = z.object({ to: z.string().trim().toLowerCase().email("Enter a valid email address") });

export async function sendTestEmailAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("email.configure");
    const parsed = testSchema.safeParse({ to: fd.get("to") });
    if (!parsed.success) return zodFailure(parsed.error);
    if (!(await rateLimit(RATE_LIMITS.testEmailPerUser, user.id)).allowed) return failure("Too many test emails. Wait a few minutes.");

    const [email, business] = await Promise.all([getSettingFresh("email"), getSettingFresh("business")]);
    const { html, text } = layout({
      brandName: business.name,
      heading: "Test email",
      paragraphs: [
        `This is a test from the ${business.name} website admin, sent by ${user.name}.`,
        `Provider: ${email.provider}. Sender: ${email.fromName} <${email.fromAddress || "not set"}>.`,
        "If you received this, form notifications and customer acknowledgements can be delivered.",
      ],
    });
    const res = await sendEmail(
      { to: [parsed.data.to], subject: `Test email from ${business.name}`, html, text, idempotencyKey: `test:${user.id}:${Date.now()}` },
      { template: "admin.test", force: true, logRecipients: true },
    );
    await saveSetting("email", { ...email, lastTestAt: new Date().toISOString(), lastTestOk: res.ok }, user.id);
    await audit("email.test", { actorUserId: user.id, entityType: "settings", entityId: "email", metadata: { ok: res.ok } });
    return res.ok
      ? { ok: true, message: `Sent to ${parsed.data.to}. Check the inbox (and spam folder).`, at: Date.now() }
      : failure(`Sending failed: ${res.error}`);
  });
}
