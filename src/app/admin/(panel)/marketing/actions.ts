"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { buildProvider } from "@/lib/email/providers";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { assertPermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { sendSms } from "@/lib/sms/twilio";
import {
  channelProblem,
  importContacts,
  normaliseEmail,
  normalisePhone,
  parseContacts,
  renderCampaignEmail,
  sendNextBatch,
  smsText,
  startCampaign,
  type BatchResult,
} from "@/domain/marketing";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const uuid = z.string().uuid();

/* -------------------------------------------------------------------------- */
/* Contacts                                                                   */
/* -------------------------------------------------------------------------- */

export async function uploadContactsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.manage");
    if (!bool(fd, "consent")) return failure("Confirm that these people agreed to receive marketing from you.", { consent: "Required" });
    const consentNote = str(fd, "consentNote");
    if (!consentNote) return failure("Say how and when these people agreed (e.g. “Signed up at the till, 2026”).", { consentNote: "Required" });

    const file = fd.get("file");
    let text = str(fd, "pasted");
    let source = "pasted list";
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) return failure("That file is over 2 MB. Split it into smaller files.");
      if (!/\.(csv|txt)$/i.test(file.name)) return failure("Upload a .csv or .txt file (save Excel sheets as CSV).");
      text = await file.text();
      source = `upload:${file.name.slice(0, 80)}`;
    }
    if (!text.trim()) return failure("Choose a file or paste some contacts.");

    const { contacts, invalid } = parseContacts(text);
    if (contacts.length === 0) return failure(`No email addresses or mobile numbers were found${invalid ? ` (${invalid} line(s) couldn't be read)` : ""}.`);
    if (contacts.length > 20000) return failure("That's more than 20,000 contacts. Split the file.");
    const r = await importContacts(contacts, { source, consentNote: consentNote.slice(0, 300), userId: user.id, invalid });
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: "contacts-upload", metadata: { ...r } });
    const parts = [
      `${r.added} added`,
      r.updated ? `${r.updated} updated` : "",
      r.unchanged ? `${r.unchanged} already on the list` : "",
      r.invalid ? `${r.invalid} line(s) skipped (no valid email or mobile)` : "",
      r.keptUnsubscribed ? `${r.keptUnsubscribed} had unsubscribed and stay unsubscribed` : "",
    ].filter(Boolean);
    return { ok: true, message: `Done: ${parts.join(", ")}.`, at: Date.now() };
  });
}

export async function addContactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.manage");
    const rawEmail = str(fd, "email");
    const rawPhone = str(fd, "phone");
    const email = rawEmail ? normaliseEmail(rawEmail) : null;
    const phone = rawPhone ? normalisePhone(rawPhone) : null;
    if (rawEmail && !email) return failure("Check the email address.", { email: "Not a valid email address" });
    if (rawPhone && !phone) return failure("Check the mobile number (UK numbers can start 07 or +44).", { phone: "Not a valid mobile number" });
    if (!email && !phone) return failure("Enter an email address, a mobile number, or both.");
    if (!bool(fd, "consent")) return failure("Confirm this person agreed to receive marketing from you.", { consent: "Required" });
    const r = await importContacts([{ name: str(fd, "name").slice(0, 120), email, phone }], { source: "manual", consentNote: str(fd, "consentNote").slice(0, 300) || "Added by staff", userId: user.id });
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: "contact-add", metadata: { ...r } });
    return { ok: true, message: r.added ? "Contact added." : r.keptUnsubscribed ? "This person has unsubscribed, so they stay unsubscribed." : "Already on the list (details filled in where missing).", at: Date.now() };
  });
}

/** Staff can opt someone out; opting back in must come from the person themselves. */
export async function unsubscribeContactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.manage");
    const id = str(fd, "id");
    const channel = str(fd, "channel");
    if (!uuid.safeParse(id).success || !["email", "sms"].includes(channel)) return failure("Unknown contact.");
    await db
      .update(t.marketingContacts)
      .set(channel === "email" ? { emailStatus: "unsubscribed", unsubscribedAt: new Date() } : { smsStatus: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(t.marketingContacts.id, id));
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: id, metadata: { unsubscribed: channel } });
    return success(channel === "email" ? "Unsubscribed from emails." : "Unsubscribed from texts.");
  });
}

export async function deleteContactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.manage");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown contact.");
    await db.delete(t.marketingContacts).where(eq(t.marketingContacts.id, id));
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: id, metadata: { erased: true } });
    return success("Contact erased.");
  });
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

export async function createCampaignAction(fd: FormData): Promise<void> {
  const user = await assertPermission("marketing.send");
  const channel = str(fd, "channel") === "sms" ? "sms" : "email";
  const business = await getSettingFresh("business");
  const [row] = await db
    .insert(t.marketingCampaigns)
    .values({
      channel,
      name: channel === "email" ? "New email" : "New text message",
      subject: channel === "email" ? `News from ${business.name}` : "",
      body: "",
      audience: { newsletter: channel === "email", contacts: true },
      createdById: user.id,
    })
    .returning({ id: t.marketingCampaigns.id });
  redirect(`/admin/marketing/${row.id}`);
}

const draftSchema = z.object({
  name: z.string().trim().min(1, "Give the campaign a name").max(120),
  subject: z.string().trim().max(150),
  body: z.string().trim().min(1, "Write the message").max(10000),
  ctaLabel: z.string().trim().max(40),
  ctaUrl: z.union([z.literal(""), z.string().trim().url("Enter a full link starting https://").startsWith("https://", "Use an https:// link")]),
});

async function draftFor(id: string) {
  if (!uuid.safeParse(id).success) return null;
  return (await db.query.marketingCampaigns.findFirst({ where: eq(t.marketingCampaigns.id, id) })) ?? null;
}

export async function saveCampaignAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.send");
    const c = await draftFor(str(fd, "id"));
    if (!c) return failure("Campaign not found.");
    if (c.status !== "draft") return failure("This campaign has already been sent.");
    const parsed = draftSchema.safeParse({ name: str(fd, "name"), subject: str(fd, "subject"), body: str(fd, "body"), ctaLabel: str(fd, "ctaLabel"), ctaUrl: str(fd, "ctaUrl") });
    if (!parsed.success) return zodFailure(parsed.error);
    if (c.channel === "email" && !parsed.data.subject) return failure("Add a subject line.", { subject: "Required" });
    if (c.channel === "sms" && parsed.data.body.length > 900) return failure("Keep texts under 900 characters.", { body: "Too long" });
    const audience = { newsletter: c.channel === "email" && bool(fd, "audienceNewsletter"), contacts: bool(fd, "audienceContacts") };
    if (!audience.newsletter && !audience.contacts) return failure("Choose who to send it to.");
    await db.update(t.marketingCampaigns).set({ ...parsed.data, audience }).where(eq(t.marketingCampaigns.id, c.id));
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: c.id, metadata: { saved: true } });
    return success("Saved.");
  });
}

export async function sendCampaignTestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.send");
    const c = await draftFor(str(fd, "id"));
    if (!c) return failure("Campaign not found.");
    if (!(await rateLimit(RATE_LIMITS.testEmailPerUser, `campaign:${user.id}`)).allowed) return failure("Too many tests. Wait a few minutes.");
    const problem = await channelProblem(c.channel);
    if (problem) return failure(problem);
    if (c.channel === "email") {
      const to = normaliseEmail(str(fd, "to"));
      if (!to) return failure("Enter an email address.", { to: "Not a valid email address" });
      const { html, text } = await renderCampaignEmail(c, to);
      const res = await buildProvider(await getSettingFresh("email")).send({ to: [to], subject: `[Test] ${c.subject}`, html, text, idempotencyKey: `campaign-test:${c.id}:${Date.now()}` });
      return res.ok ? { ok: true, message: `Test sent to ${to}. This saved version was used.`, at: Date.now() } : failure(res.error);
    }
    const to = normalisePhone(str(fd, "to"));
    if (!to) return failure("Enter a mobile number.", { to: "Not a valid mobile number" });
    const res = await sendSms(to, await smsText(c.body));
    return res.ok ? { ok: true, message: `Test text sent to ${to}. This saved version was used.`, at: Date.now() } : failure(res.error);
  });
}

export async function startCampaignAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.send");
    const c = await draftFor(str(fd, "id"));
    if (!c) return failure("Campaign not found.");
    if (c.status !== "draft") return failure("This campaign has already been started.");
    if (!c.body.trim() || (c.channel === "email" && !c.subject.trim())) return failure("Save the message first.");
    const problem = await channelProblem(c.channel);
    if (problem) return failure(problem);
    const n = await startCampaign(c.id);
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: c.id, metadata: { started: true, recipients: n, channel: c.channel } });
    if (n === 0) return failure("Nobody is on the chosen list yet, so nothing was sent.");
    redirect(`/admin/marketing/${c.id}`);
  });
}

/** Called repeatedly by the campaign page while it's open, until everyone has been sent to. */
export async function sendBatchAction(id: string): Promise<BatchResult | { error: string }> {
  try {
    await assertPermission("marketing.send");
    if (!uuid.safeParse(id).success) return { error: "Campaign not found." };
    return await sendNextBatch(id);
  } catch (err) {
    console.error("[marketing] batch failed:", (err as Error).message);
    return { error: "Sending paused because of an error. Press Resume to try again." };
  }
}

export async function cancelCampaignAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("marketing.send");
    const c = await draftFor(str(fd, "id"));
    if (!c || c.status !== "sending") return failure("Only a campaign that's sending can be stopped.");
    await db.update(t.marketingCampaigns).set({ status: "cancelled", finishedAt: new Date() }).where(eq(t.marketingCampaigns.id, c.id));
    await db
      .update(t.marketingSends)
      .set({ status: "skipped", error: "Stopped" })
      .where(and(eq(t.marketingSends.campaignId, c.id), eq(t.marketingSends.status, "pending")));
    await audit("settings.update", { actorUserId: user.id, entityType: "marketing", entityId: c.id, metadata: { cancelled: true } });
    return success("Stopped. Nobody else will receive it.");
  });
}

export async function deleteCampaignAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertPermission("marketing.send");
    const c = await draftFor(str(fd, "id"));
    if (!c) return failure("Campaign not found.");
    if (c.status !== "draft") return failure("Sent campaigns are kept as a record.");
    await db.delete(t.marketingCampaigns).where(eq(t.marketingCampaigns.id, c.id));
    redirect("/admin/marketing");
  });
}
