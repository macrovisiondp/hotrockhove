import "server-only";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { revealSecret, type EmailSettings } from "@/lib/settings";

export type OutgoingEmail = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

/** Application features talk to this interface only, never to a vendor SDK. */
export interface EmailProvider {
  readonly name: string;
  send(msg: OutgoingEmail): Promise<SendResult>;
}

export class EmailNotConfiguredError extends Error {}

function fromHeader(s: EmailSettings): string {
  if (!s.fromAddress) throw new EmailNotConfiguredError("Sender address is not set (Admin → Email).");
  const name = s.fromName.replace(/["<>]/g, "");
  return name ? `${name} <${s.fromAddress}>` : s.fromAddress;
}

export function resendProvider(apiKey: string, s: EmailSettings): EmailProvider {
  const client = new Resend(apiKey);
  return {
    name: "resend",
    async send(msg) {
      const { data, error } = await client.emails.send(
        {
          from: fromHeader(s),
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          replyTo: msg.replyTo || s.replyTo || undefined,
        },
        { idempotencyKey: msg.idempotencyKey.slice(0, 256) },
      );
      if (error) return { ok: false, error: describeResendError(error) };
      return { ok: true, id: data?.id ?? null };
    },
  };
}

function describeResendError(error: { message: string; name?: string; statusCode?: number | null }): string {
  const name = error.name ?? "";
  if (name === "validation_error" && /domain/i.test(error.message))
    return `Resend: ${error.message} — verify the sending domain in Resend (DKIM/SPF records) or use a verified address.`;
  if (name === "missing_api_key" || name === "invalid_api_key" || error.statusCode === 401 || error.statusCode === 403)
    return "Resend rejected the API key. Paste a new key in Admin → Email.";
  if (name === "rate_limit_exceeded") return "Resend rate limit reached. Try again shortly.";
  return `Resend: ${error.message}`.slice(0, 400);
}

export function smtpProvider(s: EmailSettings): EmailProvider {
  const { host, port, secure, user } = s.smtp;
  const password = revealSecret(s.smtp.password);
  if (!host || !user || !password) throw new EmailNotConfiguredError("SMTP host, user and password are required.");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  return {
    name: "smtp",
    async send(msg) {
      try {
        const info = await transport.sendMail({
          from: fromHeader(s),
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          replyTo: msg.replyTo || s.replyTo || undefined,
          messageId: undefined,
          headers: { "X-Entity-Ref-ID": msg.idempotencyKey.slice(0, 120) },
        });
        return { ok: true, id: info.messageId ?? null };
      } catch (err) {
        const e = err as { code?: string; responseCode?: number; message?: string };
        if (e.code === "EAUTH")
          return { ok: false, error: "SMTP login failed. Many providers (Yahoo, Gmail, Outlook) require an app password." };
        if (e.code === "ECONNECTION" || e.code === "ETIMEDOUT")
          return { ok: false, error: `Could not connect to ${host}:${port}. Check host, port and TLS setting.` };
        return { ok: false, error: `SMTP: ${e.message ?? "send failed"}`.slice(0, 400) };
      }
    },
  };
}

/**
 * Provider for the current settings. The Resend key comes from Admin → Email
 * (encrypted), falling back to the RESEND_API_KEY environment variable.
 */
export function buildProvider(s: EmailSettings): EmailProvider {
  if (s.provider === "none") throw new EmailNotConfiguredError("No email provider is selected.");
  if (s.provider === "smtp") return smtpProvider(s);
  const key = revealSecret(s.resendApiKey) || env().RESEND_API_KEY;
  if (!key) throw new EmailNotConfiguredError("No Resend API key is saved (Admin → Email).");
  return resendProvider(key, s);
}

/** Configuration problems that would stop delivery, for dashboards and the email page. */
export function emailConfigIssues(s: EmailSettings): string[] {
  const issues: string[] = [];
  if (s.provider === "none") issues.push("No email provider selected.");
  if (s.provider === "resend" && !s.resendApiKey && !env().RESEND_API_KEY) issues.push("Resend API key not saved.");
  if (s.provider === "smtp" && (!s.smtp.host || !s.smtp.user || !s.smtp.password))
    issues.push("SMTP host, user or password missing.");
  if (!s.fromAddress) issues.push("Sender address not set.");
  if (!s.deliveryEnabled) issues.push("Email delivery is switched off.");
  if (s.lastTestOk !== true) issues.push("No successful test email yet.");
  return issues;
}
