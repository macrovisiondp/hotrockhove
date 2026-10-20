import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { audit, clientIp } from "@/lib/audit";
import { hashIdentifier } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { layout } from "@/lib/email/templates";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { fillTemplate, getSettingFresh } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { displayRows, parseFields, submissionValidator, submitterEmail, type FormField } from "./fields";

export const HONEYPOT_FIELD = "company_website";

export type PublicFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  /** Echo of submitted values so the form keeps them after a validation error. */
  values?: Record<string, string>;
  at?: number;
};

export async function getForm(key: string) {
  const form = await db.query.forms.findFirst({ where: eq(t.forms.key, key) });
  if (!form) return null;
  return { ...form, fields: parseFields(form.fields) };
}

function echo(fd: FormData, fields: FormField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = fd.get(f.name);
    if (typeof v === "string") out[f.name] = v.slice(0, 5000);
  }
  return out;
}

/** Handle a public form submission. Returns a state for useActionState; never leaks internals. */
export async function handleSubmission(formKey: string, fd: FormData): Promise<PublicFormState> {
  const form = await getForm(formKey);
  if (!form || !form.enabled) return { status: "error", message: "This form is not currently available.", at: Date.now() };

  const ip = (await clientIp()) ?? "unknown";
  const values = echo(fd, form.fields);

  // 1. Honeypot: bots fill hidden fields. Pretend success so they learn nothing.
  const trap = fd.get(HONEYPOT_FIELD);
  if (typeof trap === "string" && trap.trim() !== "") {
    await audit("security.honeypot", { entityType: "form", entityId: formKey });
    return { status: "success", message: form.successMessage, at: Date.now() };
  }

  // 2. Rate limit per IP.
  const ipLimit = await rateLimit(RATE_LIMITS.formPerIp, `${formKey}:${ip}`);
  if (!ipLimit.allowed) {
    await audit("security.rate_limited", { entityType: "form", entityId: formKey });
    return { status: "error", message: "Too many submissions from your connection. Please try again in a few minutes.", values, at: Date.now() };
  }

  // 3. Bot check (when Turnstile is configured).
  const token = fd.get("cf-turnstile-response");
  const ts = await verifyTurnstile(typeof token === "string" ? token : null, ip);
  if (!ts.ok) {
    await audit("security.turnstile_failed", { entityType: "form", entityId: formKey, metadata: { reason: ts.reason } });
    return { status: "error", message: "We couldn't verify you're human. Please try again.", values, at: Date.now() };
  }

  // 4. Validate against the form definition.
  const raw: Record<string, unknown> = {};
  for (const f of form.fields) if (f.type !== "note") raw[f.name] = fd.get(f.name) ?? "";
  const parsed = submissionValidator(form.fields).safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors, values, at: Date.now() };
  }
  const data = parsed.data as Record<string, string | boolean>;

  const email = submitterEmail(form.fields, data);
  if (email) {
    const emailLimit = await rateLimit(RATE_LIMITS.formPerEmail, `${formKey}:${email}`);
    if (!emailLimit.allowed) {
      return { status: "error", message: "We've already received a few messages from this address. Please try again later.", values, at: Date.now() };
    }
  }

  // 5. Persist before any email is attempted.
  const [row] = await db
    .insert(t.formSubmissions)
    .values({ formKey, data, ipHash: hashIdentifier(ip) })
    .returning({ id: t.formSubmissions.id });

  // 6. Notifications run after the response is sent; failures are logged, never shown.
  after(() => notify(form, row.id, data).catch((e) => console.error("[forms] notify failed:", (e as Error).message)));

  return { status: "success", message: form.successMessage, at: Date.now() };
}

type LoadedForm = NonNullable<Awaited<ReturnType<typeof getForm>>>;

export async function notify(form: LoadedForm, submissionId: string, data: Record<string, string | boolean>) {
  const [business, notifications] = await Promise.all([getSettingFresh("business"), getSettingFresh("notifications")]);
  const vars: Record<string, string> = { brandName: business.name, formName: form.name };
  for (const [k, v] of Object.entries(data)) vars[k] = typeof v === "boolean" ? (v ? "Yes" : "No") : v;
  const rows = displayRows(form.fields, data);
  const submitter = submitterEmail(form.fields, data);

  if (form.notifyAdmin) {
    const recipients = form.recipients.length ? form.recipients : notifications.recipients;
    if (recipients.length) {
      const { html, text } = layout({
        brandName: business.name,
        heading: `New ${form.name} submission`,
        paragraphs: ["A new submission was received on the website. Reply to this email to respond to the sender."],
        rows,
        footer: "You're receiving this because your address is a notification recipient in the website admin.",
      });
      await sendEmail(
        {
          to: recipients,
          subject: fillTemplate(form.adminSubject, vars).slice(0, 200) || `New ${form.name} submission`,
          html,
          text,
          replyTo: submitter ?? undefined,
          idempotencyKey: `submission:${submissionId}:admin`,
        },
        { template: `${form.key}.admin`, logRecipients: true },
      );
    }
  }

  if (form.sendAcknowledgement && submitter && form.ackSubject && form.ackBody) {
    const { html, text } = layout({
      brandName: business.name,
      heading: fillTemplate(form.ackSubject, vars),
      paragraphs: fillTemplate(form.ackBody, vars).split(/\n{2,}/),
      footer: [business.name, business.phone, business.email].filter(Boolean).join(" · "),
    });
    await sendEmail(
      {
        to: [submitter],
        subject: fillTemplate(form.ackSubject, vars).slice(0, 200),
        html,
        text,
        idempotencyKey: `submission:${submissionId}:ack`,
      },
      { template: `${form.key}.ack` },
    );
  }
}
