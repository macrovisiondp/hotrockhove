import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db, t } from "@/db";
import { hashIdentifier } from "@/lib/crypto";
import { buildProvider, EmailNotConfiguredError } from "@/lib/email/providers";
import { layout } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { formatAddress, getSettingFresh, revealSecret } from "@/lib/settings";
import { sendSms, twilioReady } from "@/lib/sms/twilio";

/* -------------------------------------------------------------------------- */
/* Contacts: parsing and normalising                                          */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[A-Za-z]{2,}$/;

export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase().replace(/^mailto:/, "");
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

/**
 * Phone numbers → E.164. UK numbers may be written 07700 900123, +44 7700 900123,
 * 0044…, or 447700900123. Other countries need a leading + and country code.
 */
export function normalisePhone(raw: string): string | null {
  let p = raw.trim().replace(/[\s().-]/g, "");
  if (!p) return null;
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^0\d{9,10}$/.test(p)) p = "+44" + p.slice(1);
  else if (/^44\d{9,10}$/.test(p)) p = "+" + p;
  if (!/^\+[1-9]\d{7,14}$/.test(p)) return null;
  if (p.startsWith("+44") && !/^\+44\d{10}$/.test(p)) return null;
  return p;
}

export type ParsedContact = { name: string; email: string | null; phone: string | null };

/** Minimal CSV line split: commas, quoted fields with "" escapes. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse an uploaded CSV / pasted list. With a header row, columns named like
 * email / phone / mobile / name are used; without one, each value is recognised
 * as an email or a phone number and anything else on the line becomes the name.
 */
export function parseContacts(text: string): { contacts: ParsedContact[]; invalid: number } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { contacts: [], invalid: 0 };
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const hasHeader = header.some((h) => /e-?mail|phone|mobile|tel|name/.test(h)) && !header.some((h) => normaliseEmail(h) || normalisePhone(h));
  const ei = hasHeader ? col(/e-?mail/) : -1;
  const pi = hasHeader ? col(/phone|mobile|tel|number/) : -1;
  const ni = hasHeader ? col(/^(full ?)?name$|^first|name/) : -1;
  const li = hasHeader ? col(/^last|surname/) : -1;

  const contacts: ParsedContact[] = [];
  let invalid = 0;
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCsv(line);
    let email: string | null = null;
    let phone: string | null = null;
    let name = "";
    if (hasHeader) {
      email = ei >= 0 && cells[ei] ? normaliseEmail(cells[ei]) : null;
      phone = pi >= 0 && cells[pi] ? normalisePhone(cells[pi]) : null;
      name = [ni >= 0 ? cells[ni] : "", li >= 0 ? cells[li] : ""].filter(Boolean).join(" ").trim();
    } else {
      const rest: string[] = [];
      for (const c of cells) {
        if (!email && normaliseEmail(c)) email = normaliseEmail(c);
        else if (!phone && normalisePhone(c)) phone = normalisePhone(c);
        else if (c) rest.push(c);
      }
      name = rest.join(" ");
    }
    if (!email && !phone) {
      invalid++;
      continue;
    }
    contacts.push({ name: name.slice(0, 120), email, phone });
  }
  return { contacts, invalid };
}

export type ImportResult = { added: number; updated: number; unchanged: number; invalid: number; keptUnsubscribed: number };

/**
 * Add parsed contacts. Existing contacts (matched by email or phone) gain any
 * missing details; their consent status is never changed, so someone who
 * unsubscribed stays unsubscribed. Newsletter unsubscribes are honoured too.
 */
export async function importContacts(rows: ParsedContact[], opts: { source: string; consentNote: string; userId: string; invalid?: number }): Promise<ImportResult> {
  const res: ImportResult = { added: 0, updated: 0, unchanged: 0, invalid: opts.invalid ?? 0, keptUnsubscribed: 0 };
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.email ?? ""}|${r.phone ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = await db
      .select()
      .from(t.marketingContacts)
      .where(
        r.email && r.phone
          ? sql`${t.marketingContacts.email} = ${r.email} or ${t.marketingContacts.phone} = ${r.phone}`
          : r.email
            ? eq(t.marketingContacts.email, r.email)
            : eq(t.marketingContacts.phone, r.phone!),
      )
      .limit(2);
    const existing = matches[0];
    if (existing) {
      const patch: Partial<typeof t.marketingContacts.$inferInsert> = {};
      if (!existing.email && r.email && !matches.some((m) => m.email === r.email)) patch.email = r.email;
      if (!existing.phone && r.phone && !matches.some((m) => m.phone === r.phone)) patch.phone = r.phone;
      if (!existing.name && r.name) patch.name = r.name;
      if (Object.keys(patch).length) {
        await db.update(t.marketingContacts).set(patch).where(eq(t.marketingContacts.id, existing.id));
        res.updated++;
      } else res.unchanged++;
      if (existing.emailStatus === "unsubscribed" || existing.smsStatus === "unsubscribed") res.keptUnsubscribed++;
      continue;
    }
    // A newsletter unsubscribe for this email also applies here.
    let emailStatus: "subscribed" | "unsubscribed" = "subscribed";
    if (r.email) {
      const sub = await db.query.newsletterSubscribers.findFirst({ where: eq(t.newsletterSubscribers.email, r.email) });
      if (sub?.status === "unsubscribed") {
        emailStatus = "unsubscribed";
        res.keptUnsubscribed++;
      }
    }
    await db
      .insert(t.marketingContacts)
      .values({ name: r.name, email: r.email, phone: r.phone, emailStatus, source: opts.source, consentNote: opts.consentNote, createdById: opts.userId })
      .onConflictDoNothing();
    res.added++;
  }
  return res;
}

/* -------------------------------------------------------------------------- */
/* Unsubscribe links (signed, no stored token needed)                         */
/* -------------------------------------------------------------------------- */

export function unsubscribeToken(email: string): string {
  return `${Buffer.from(email).toString("base64url")}.${hashIdentifier(`unsubscribe:${email}`)}`;
}

export function emailFromUnsubscribeToken(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig || token.length > 600) return null;
  let email: string;
  try {
    email = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return normaliseEmail(email) === email && hashIdentifier(`unsubscribe:${email}`) === sig ? email : null;
}

export function unsubscribeUrl(email: string): string {
  return `${env().APP_URL}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(email))}`;
}

/** For the List-Unsubscribe header: mail apps POST here for one-click unsubscribe (RFC 8058). */
export function oneClickUnsubscribeUrl(email: string): string {
  return `${env().APP_URL}/api/unsubscribe?t=${encodeURIComponent(unsubscribeToken(email))}`;
}

/** Stop all marketing email to this address (newsletter and uploaded contacts). */
export async function unsubscribeEmail(email: string): Promise<void> {
  const now = new Date();
  await db
    .update(t.newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: now })
    .where(eq(t.newsletterSubscribers.email, email));
  await db.update(t.marketingContacts).set({ emailStatus: "unsubscribed", unsubscribedAt: now }).where(eq(t.marketingContacts.email, email));
}

/** STOP / START replies to marketing texts. */
export async function setSmsConsent(phone: string, subscribed: boolean): Promise<number> {
  const rows = await db
    .update(t.marketingContacts)
    .set({ smsStatus: subscribed ? "subscribed" : "unsubscribed", unsubscribedAt: subscribed ? null : new Date() })
    .where(eq(t.marketingContacts.phone, phone))
    .returning({ id: t.marketingContacts.id });
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Audiences                                                                  */
/* -------------------------------------------------------------------------- */

export type Audience = { newsletter: boolean; contacts: boolean };

/** Everyone who opted out of email anywhere is excluded everywhere. */
async function emailSuppressions(): Promise<Set<string>> {
  const a = await db.select({ e: t.newsletterSubscribers.email }).from(t.newsletterSubscribers).where(eq(t.newsletterSubscribers.status, "unsubscribed"));
  const b = await db
    .select({ e: t.marketingContacts.email })
    .from(t.marketingContacts)
    .where(and(eq(t.marketingContacts.emailStatus, "unsubscribed"), isNotNull(t.marketingContacts.email)));
  return new Set([...a, ...b].map((r) => r.e!).filter(Boolean));
}

export async function emailAudience(aud: Audience): Promise<string[]> {
  const out = new Set<string>();
  if (aud.newsletter) {
    const subs = await db.select({ e: t.newsletterSubscribers.email }).from(t.newsletterSubscribers).where(eq(t.newsletterSubscribers.status, "subscribed"));
    subs.forEach((r) => out.add(r.e));
  }
  if (aud.contacts) {
    const cs = await db
      .select({ e: t.marketingContacts.email })
      .from(t.marketingContacts)
      .where(and(eq(t.marketingContacts.emailStatus, "subscribed"), isNotNull(t.marketingContacts.email)));
    cs.forEach((r) => r.e && out.add(r.e));
  }
  const suppressed = await emailSuppressions();
  return [...out].filter((e) => !suppressed.has(e)).sort();
}

export async function smsAudience(): Promise<string[]> {
  const rows = await db
    .select({ p: t.marketingContacts.phone })
    .from(t.marketingContacts)
    .where(and(eq(t.marketingContacts.smsStatus, "subscribed"), isNotNull(t.marketingContacts.phone)));
  return [...new Set(rows.map((r) => r.p!))].sort();
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

type Campaign = typeof t.marketingCampaigns.$inferSelect;

export async function renderCampaignEmail(c: Pick<Campaign, "subject" | "body" | "ctaLabel" | "ctaUrl">, email: string) {
  const business = await getSettingFresh("business");
  const address = formatAddress(business);
  return layout({
    brandName: business.name,
    heading: c.subject,
    paragraphs: c.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    cta: c.ctaLabel && c.ctaUrl ? { label: c.ctaLabel, url: c.ctaUrl } : undefined,
    footer: `You're receiving this because you signed up for news and offers from ${business.name}.${address ? ` ${business.name}, ${address}.` : ""}`,
    unsubscribeUrl: unsubscribeUrl(email),
  });
}

export async function smsText(body: string): Promise<string> {
  const tw = await getSettingFresh("twilio");
  return tw.optOutText ? `${body.trim()}\n${tw.optOutText}` : body.trim();
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                    */
/* -------------------------------------------------------------------------- */

export const EMAIL_BATCH = 50;
export const SMS_BATCH = 15;

/** Check the channel is connected; returns a reason when it isn't. */
export async function channelProblem(channel: "email" | "sms"): Promise<string | null> {
  if (channel === "email") {
    const s = await getSettingFresh("email");
    if (!s.deliveryEnabled || !s.fromAddress) return "Email isn't connected. Set it up under Connections.";
    try {
      buildProvider(s);
    } catch (e) {
      return e instanceof EmailNotConfiguredError ? e.message : "Email isn't connected.";
    }
    return null;
  }
  return twilioReady(await getSettingFresh("twilio")) ? null : "Twilio isn't connected. Set it up under Connections.";
}

/** Queue every recipient for a draft campaign and mark it as sending. Returns the number queued. */
export async function startCampaign(id: string): Promise<number> {
  const c = await db.query.marketingCampaigns.findFirst({ where: eq(t.marketingCampaigns.id, id) });
  if (!c || c.status !== "draft") return 0;
  const recipients = c.channel === "email" ? await emailAudience(c.audience) : await smsAudience();
  for (let i = 0; i < recipients.length; i += 500) {
    await db
      .insert(t.marketingSends)
      .values(recipients.slice(i, i + 500).map((recipient) => ({ campaignId: id, recipient })))
      .onConflictDoNothing();
  }
  await db
    .update(t.marketingCampaigns)
    .set({ status: recipients.length ? "sending" : "sent", total: recipients.length, startedAt: new Date(), finishedAt: recipients.length ? null : new Date() })
    .where(eq(t.marketingCampaigns.id, id));
  return recipients.length;
}

export type BatchResult = { status: Campaign["status"]; total: number; sent: number; failed: number; pending: number; error?: string };

async function progress(id: string): Promise<BatchResult> {
  const c = (await db.query.marketingCampaigns.findFirst({ where: eq(t.marketingCampaigns.id, id) }))!;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t.marketingSends)
    .where(and(eq(t.marketingSends.campaignId, id), eq(t.marketingSends.status, "pending")));
  return { status: c.status, total: c.total, sent: c.sent, failed: c.failed, pending: n };
}

/**
 * Send the next batch of a campaign. Safe to call repeatedly and concurrently:
 * rows are claimed by status, and email batches use an idempotency key.
 */
export async function sendNextBatch(id: string): Promise<BatchResult> {
  const c = await db.query.marketingCampaigns.findFirst({ where: eq(t.marketingCampaigns.id, id) });
  if (!c) throw new Error("Campaign not found");
  if (c.status !== "sending") return progress(id);
  const problem = await channelProblem(c.channel);
  if (problem) return { ...(await progress(id)), error: problem };

  // Release claims left by a batch that never finished (closed tab, timeout).
  await db
    .update(t.marketingSends)
    .set({ status: "pending", claimedAt: null })
    .where(and(eq(t.marketingSends.campaignId, id), eq(t.marketingSends.status, "sending"), sql`${t.marketingSends.claimedAt} < now() - interval '5 minutes'`));

  // Claim the next rows atomically so two open tabs never send the same message twice.
  const limit = c.channel === "email" ? EMAIL_BATCH : SMS_BATCH;
  const batch = (await db.execute(sql`
    update marketing_sends set status = 'sending', claimed_at = now()
    where id in (
      select id from marketing_sends
      where campaign_id = ${id} and status = 'pending'
      order by recipient
      limit ${limit}
      for update skip locked
    )
    returning id, recipient
  `)) as unknown as { id: string; recipient: string }[] | { rows: { id: string; recipient: string }[] };

  const claimed = Array.isArray(batch) ? batch : batch.rows;
  if (claimed.length) {
    // Re-check consent at send time: someone may have unsubscribed since the campaign started.
    const stillOk =
      c.channel === "email" ? new Set(await emailAudience(c.audience)) : new Set(await smsAudience());
    const skip = claimed.filter((r) => !stillOk.has(r.recipient));
    if (skip.length)
      await db.update(t.marketingSends).set({ status: "skipped", error: "Unsubscribed" }).where(inArray(t.marketingSends.id, skip.map((r) => r.id)));
    const todo = claimed.filter((r) => stillOk.has(r.recipient));

    const outcomes = c.channel === "email" ? await sendEmailBatch(c, todo) : await sendSmsBatch(c, todo);
    for (const o of outcomes) {
      await db
        .update(t.marketingSends)
        .set(o.ok ? { status: "sent", providerMessageId: o.id, sentAt: new Date(), error: null } : { status: "failed", error: o.error.slice(0, 300) })
        .where(eq(t.marketingSends.id, o.sendId));
    }
    const sent = outcomes.filter((o) => o.ok).length;
    const failed = outcomes.length - sent;
    await db
      .update(t.marketingCampaigns)
      .set({ sent: sql`${t.marketingCampaigns.sent} + ${sent}`, failed: sql`${t.marketingCampaigns.failed} + ${failed}` })
      .where(eq(t.marketingCampaigns.id, id));
  }

  const p = await progress(id);
  const [{ inFlight }] = await db
    .select({ inFlight: sql<number>`count(*)::int` })
    .from(t.marketingSends)
    .where(and(eq(t.marketingSends.campaignId, id), eq(t.marketingSends.status, "sending")));
  if (p.pending === 0 && inFlight === 0 && p.status === "sending") {
    await db.update(t.marketingCampaigns).set({ status: "sent", finishedAt: new Date() }).where(eq(t.marketingCampaigns.id, id));
    p.status = "sent";
  }
  return p;
}

type Outcome = { sendId: string } & ({ ok: true; id: string | null } | { ok: false; error: string });
type SendRow = { id: string; recipient: string };

async function sendEmailBatch(c: Campaign, rows: SendRow[]): Promise<Outcome[]> {
  if (!rows.length) return [];
  const s = await getSettingFresh("email");
  const messages = await Promise.all(rows.map(async (r) => ({ r, ...(await renderCampaignEmail(c, r.recipient)) })));
  const from = s.fromName ? `${s.fromName.replace(/["<>]/g, "")} <${s.fromAddress}>` : s.fromAddress;
  const key = revealSecret(s.resendApiKey) || env().RESEND_API_KEY;

  if (s.provider === "resend" && key) {
    const client = new Resend(key);
    const { data, error } = await client.batch.send(
      messages.map((m) => {
        const unsub = oneClickUnsubscribeUrl(m.r.recipient);
        return {
          from,
          to: [m.r.recipient],
          subject: c.subject,
          html: m.html,
          text: m.text,
          replyTo: s.replyTo || undefined,
          headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        };
      }),
      { idempotencyKey: `campaign:${c.id}:${rows[0].id}:${rows.length}` },
    );
    if (error) return rows.map((r) => ({ sendId: r.id, ok: false as const, error: `Resend: ${error.message}` }));
    return rows.map((r, i) => ({ sendId: r.id, ok: true as const, id: data?.data?.[i]?.id ?? null }));
  }

  // SMTP (or no batch API): one at a time.
  const provider = buildProvider(s);
  const out: Outcome[] = [];
  for (const m of messages) {
    const unsub = oneClickUnsubscribeUrl(m.r.recipient);
    const res = await provider.send({
      to: [m.r.recipient],
      subject: c.subject,
      html: m.html,
      text: m.text,
      idempotencyKey: `campaign:${c.id}:${m.r.id}`,
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    out.push(res.ok ? { sendId: m.r.id, ok: true, id: res.id } : { sendId: m.r.id, ok: false, error: res.error });
  }
  return out;
}

async function sendSmsBatch(c: Campaign, rows: SendRow[]): Promise<Outcome[]> {
  if (!rows.length) return [];
  const tw = await getSettingFresh("twilio");
  const body = await smsText(c.body);
  const out: Outcome[] = [];
  for (const r of rows) {
    const res = await sendSms(r.recipient, body, tw);
    out.push(res.ok ? { sendId: r.id, ok: true, id: res.id } : { sendId: r.id, ok: false, error: res.error });
  }
  return out;
}
