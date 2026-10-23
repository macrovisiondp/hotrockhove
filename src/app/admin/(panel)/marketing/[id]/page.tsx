import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { channelProblem, emailAudience, smsAudience, type BatchResult } from "@/domain/marketing";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { CampaignRunner } from "@/components/admin/campaign-runner";
import { ActionForm, ConfirmButton, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { SmsCounter } from "@/components/admin/sms-counter";
import { Badge, Card, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";
import { cancelCampaignAction, deleteCampaignAction, saveCampaignAction, sendBatchAction, sendCampaignTestAction, startCampaignAction } from "../actions";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("marketing.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await db.query.marketingCampaigns.findFirst({ where: eq(t.marketingCampaigns.id, id) });
  if (!c) notFound();
  const canSend = can(user.role, "marketing.send");
  const isEmail = c.channel === "email";
  const kind = isEmail ? "email" : "text message";

  const header = (
    <PageHeader
      title={c.name}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          {isEmail ? "Email" : "Text message"} ·{" "}
          {c.status === "draft" ? <Badge>Draft</Badge> : c.status === "sending" ? <Badge tone="info">Sending</Badge> : c.status === "sent" ? <Badge tone="good">Sent</Badge> : <Badge tone="warn">Stopped</Badge>}
          {c.startedAt && <span className="text-xs">Started {formatDateTime(c.startedAt)}</span>}
        </span>
      }
      actions={
        <Link href="/admin/marketing" className="admin-btn admin-btn-secondary">
          Back to Marketing
        </Link>
      }
    />
  );

  /* ---------------------------------------------------------------- draft */
  if (c.status === "draft") {
    const [recipients, problem, twilio] = await Promise.all([
      isEmail ? emailAudience(c.audience) : smsAudience(),
      channelProblem(c.channel),
      getSettingFresh("twilio"),
    ]);
    const ready = Boolean(c.body.trim() && (!isEmail || c.subject.trim()));
    return (
      <>
        {header}
        {problem && (
          <div className="mb-4">
            <Notice>
              {problem}{" "}
              <Link href="/admin/connections" className="underline">
                Open Connections
              </Link>
            </Notice>
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card title="Message">
            <ActionForm action={saveCampaignAction} disabled={!canSend} showCancel={false} compact>
              <input type="hidden" name="id" value={c.id} />
              <TextInput name="name" label="Campaign name (only you see this)" defaultValue={c.name} maxLength={120} required />
              {isEmail && <TextInput name="subject" label="Subject line" defaultValue={c.subject} maxLength={150} />}
              <TextArea
                name="body"
                label={isEmail ? "Email text" : "Text message"}
                defaultValue={c.body}
                rows={isEmail ? 10 : 4}
                maxLength={isEmail ? 10000 : 900}
                hint={isEmail ? "Leave a blank line between paragraphs. Your business name, address and an unsubscribe link are added at the bottom." : undefined}
              />
              {!isEmail && <SmsCounter field="body" optOut={twilio.optOutText} />}
              {isEmail && (
                <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                  <TextInput name="ctaLabel" label="Button text (optional)" defaultValue={c.ctaLabel} maxLength={40} placeholder="Book a table" />
                  <TextInput name="ctaUrl" label="Button link" defaultValue={c.ctaUrl} placeholder="https://hotrockhove.com/daisy" />
                </div>
              )}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Send to</legend>
                {isEmail && <Toggle name="audienceNewsletter" label="Newsletter subscribers (signed up on the website)" defaultChecked={c.audience.newsletter} />}
                <Toggle name="audienceContacts" label={isEmail ? "Uploaded contacts with an email address" : "Contacts with a mobile number"} defaultChecked={c.audience.contacts} />
              </fieldset>
            </ActionForm>
          </Card>

          <div className="space-y-6">
            <Card title="Recipients" description="People who unsubscribed anywhere are always left out, and nobody gets it twice.">
              <p className="text-3xl font-semibold tabular-nums">{recipients.length}</p>
              <p className="text-sm text-[#6b665e]">will receive this {kind} (based on the saved settings).</p>
            </Card>

            {canSend && !problem && (
              <Card title="Send a test" description="Saves nothing; uses the last saved version.">
                <ActionForm action={sendCampaignTestAction} submitLabel="Send test" showCancel={false} compact>
                  <input type="hidden" name="id" value={c.id} />
                  <TextInput name="to" label={isEmail ? "Email address" : "Mobile number"} type={isEmail ? "email" : "tel"} />
                </ActionForm>
              </Card>
            )}

            {canSend && (
              <Card title="Send">
                {ready && !problem && recipients.length > 0 ? (
                  <ConfirmButton
                    action={startCampaignAction}
                    hidden={{ id: c.id }}
                    label={`Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`}
                    confirmLabel="Yes, send now"
                    question={`Send this ${kind} to ${recipients.length} ${recipients.length === 1 ? "person" : "people"} now? This can't be undone.`}
                    className="admin-btn admin-btn-primary"
                  />
                ) : (
                  <p className="text-sm text-[#6b665e]">
                    {problem ? "Connect the service first." : !ready ? "Write and save the message first." : "Nobody is on the chosen list yet."}
                  </p>
                )}
                <div className="mt-4">
                  <ConfirmButton action={deleteCampaignAction} hidden={{ id: c.id }} label="Delete draft" question="Delete this draft?" className="admin-btn admin-btn-danger" />
                </div>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ------------------------------------------------- sending / sent / stopped */
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(t.marketingSends)
    .where(and(eq(t.marketingSends.campaignId, c.id), sql`${t.marketingSends.status} in ('pending','sending')`));
  const progress: BatchResult = { status: c.status, total: c.total, sent: c.sent, failed: c.failed, pending };
  const failures = await db
    .select({ recipient: t.marketingSends.recipient, error: t.marketingSends.error })
    .from(t.marketingSends)
    .where(and(eq(t.marketingSends.campaignId, c.id), eq(t.marketingSends.status, "failed")))
    .orderBy(desc(t.marketingSends.recipient))
    .limit(100);

  return (
    <>
      {header}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title={c.status === "sending" ? "Sending" : "Results"}>
          {c.status === "sending" && canSend ? (
            <CampaignRunner id={c.id} initial={progress} send={sendBatchAction} />
          ) : (
            <p className="text-sm">
              <strong>{c.sent}</strong> sent{c.failed ? <>, <strong>{c.failed}</strong> failed</> : null} of {c.total}
              {c.finishedAt && <span className="text-[#6b665e]"> · finished {formatDateTime(c.finishedAt)}</span>}
            </p>
          )}
          {c.status === "sending" && canSend && (
            <div className="mt-4">
              <ConfirmButton action={cancelCampaignAction} hidden={{ id: c.id }} label="Stop sending" confirmLabel="Yes, stop" question="Stop sending? People who haven't received it yet won't get it." className="admin-btn admin-btn-danger" />
            </div>
          )}
          {failures.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Couldn&apos;t be sent</h3>
              <ul className="space-y-1 text-xs">
                {failures.map((f) => (
                  <li key={f.recipient}>
                    <span className="font-medium">{f.recipient}</span> — <span className="text-[#6b665e]">{f.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card title="Message">
          {isEmail && <p className="mb-2 text-sm font-semibold">{c.subject}</p>}
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#3a3733]">{c.body}</p>
          {c.ctaLabel && c.ctaUrl && (
            <p className="mt-3 text-sm">
              Button: <strong>{c.ctaLabel}</strong> → <span className="break-all text-[#6b665e]">{c.ctaUrl}</span>
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
