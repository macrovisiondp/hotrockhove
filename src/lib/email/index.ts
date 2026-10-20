import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getSettingFresh } from "@/lib/settings";
import { buildProvider, EmailNotConfiguredError, type OutgoingEmail, type SendResult } from "./providers";

export type SendOptions = {
  template: string;
  /** Bypass the delivery switch (admin test emails only). */
  force?: boolean;
  /** Store recipient addresses in the log (staff inboxes). Customer addresses are never logged. */
  logRecipients?: boolean;
};

/**
 * Send one email and record the outcome. Never throws: a submission must not be
 * lost because email is down. Repeated calls with the same idempotency key are
 * no-ops once the first one is recorded.
 */
export async function sendEmail(msg: OutgoingEmail, opts: SendOptions): Promise<SendResult & { skipped?: boolean }> {
  const recipientSummary = opts.logRecipients ? msg.to.join(", ") : `${msg.to.length} recipient(s)`;

  const inserted = await db
    .insert(t.emailLog)
    .values({
      idempotencyKey: msg.idempotencyKey,
      template: opts.template,
      provider: "pending",
      recipientSummary,
      subject: msg.subject.slice(0, 300),
      status: "queued",
    })
    .onConflictDoNothing({ target: t.emailLog.idempotencyKey })
    .returning({ id: t.emailLog.id });

  if (inserted.length === 0) return { ok: true, id: null, skipped: true }; // already handled
  const logId = inserted[0].id;

  const settings = await getSettingFresh("email");
  if (!settings.deliveryEnabled && !opts.force) {
    await db
      .update(t.emailLog)
      .set({ status: "skipped", provider: settings.provider, error: "Email delivery is switched off in Admin → Email." })
      .where(eq(t.emailLog.id, logId));
    return { ok: false, error: "Email delivery is switched off.", skipped: true };
  }

  let result: SendResult;
  let providerName: string = settings.provider;
  try {
    const provider = buildProvider(settings);
    providerName = provider.name;
    result = await provider.send(msg);
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof EmailNotConfiguredError ? err.message : `Unexpected error: ${(err as Error).message}`.slice(0, 300),
    };
  }

  await db
    .update(t.emailLog)
    .set(
      result.ok
        ? { status: "sent", provider: providerName, providerMessageId: result.id }
        : { status: "failed", provider: providerName, error: result.error.slice(0, 500) },
    )
    .where(eq(t.emailLog.id, logId));

  if (!result.ok) console.error(`[email] ${opts.template} failed: ${result.error}`);
  return result;
}

export type { OutgoingEmail } from "./providers";
