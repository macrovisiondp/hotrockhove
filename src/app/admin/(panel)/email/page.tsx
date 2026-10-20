import { desc } from "drizzle-orm";
import { db, t } from "@/db";
import { emailConfigIssues } from "@/lib/email/providers";
import { env } from "@/lib/env";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh, maskSecret } from "@/lib/settings";
import { ActionForm, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";
import { saveEmailAction, saveRecipientsAction, sendTestEmailAction } from "./actions";

export const metadata = { title: "Email & notifications" };

export default async function EmailPage() {
  const user = await requirePermission("settings.view");
  const canEdit = can(user.role, "email.configure");
  const isOwner = can(user.role, "secrets.edit");
  const [email, notifications, log] = await Promise.all([
    getSettingFresh("email"),
    getSettingFresh("notifications"),
    db.select().from(t.emailLog).orderBy(desc(t.emailLog.createdAt)).limit(30),
  ]);
  const issues = emailConfigIssues(email);
  const resendMask = maskSecret(email.resendApiKey);
  const envKey = Boolean(env().RESEND_API_KEY);

  return (
    <>
      <PageHeader
        title="Email & notifications"
        description="Who is told about new enquiries, who emails come from, and the provider that sends them. Resend is the recommended provider."
      />

      <div className="mb-6">
        {issues.length === 0 ? (
          <Notice tone="good">Email is configured, switched on and tested{email.lastTestAt ? ` (last test ${formatDateTime(email.lastTestAt)})` : ""}.</Notice>
        ) : (
          <Notice tone={email.deliveryEnabled ? "bad" : "warn"}>
            <strong>Not ready to send:</strong> {issues.join(" ")}
          </Notice>
        )}
      </div>

      <div className="space-y-6">
        <Card title="Notification recipients" description="Staff inboxes that receive new form submissions. One address per line. Individual forms can override this under Forms.">
          <ActionForm action={saveRecipientsAction} disabled={!canEdit} compact>
            <TextArea
              name="recipients"
              label="Recipients"
              rows={3}
              defaultValue={notifications.recipients.join("\n")}
              placeholder="bookings@hotrockhove.com"
              hint="The old site sent notifications to info@hotrockhove.com while showing hello@hotrockhove.com publicly. Confirm which inbox the team reads."
            />
          </ActionForm>
        </Card>

        <Card title="Sender and provider">
          <ActionForm action={saveEmailAction} disabled={!canEdit}>
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                name="provider"
                label="Provider"
                defaultValue={email.provider}
                options={[
                  { value: "resend", label: "Resend (recommended)" },
                  { value: "smtp", label: "SMTP (other mail service)" },
                  { value: "none", label: "None (don't send)" },
                ]}
              />
              <TextInput name="fromName" label="Sender name" defaultValue={email.fromName} maxLength={80} />
              <TextInput
                name="fromAddress"
                label="Sender address"
                type="email"
                defaultValue={email.fromAddress}
                placeholder="no-reply@hotrockhove.com"
                hint="Must be on a domain verified in Resend (SPF/DKIM)."
              />
              <TextInput name="replyTo" label="Reply-to address" type="email" defaultValue={email.replyTo} hint="Where customer replies go. Admin notifications reply to the customer instead." />
            </div>

            <fieldset className="rounded-md border border-[#e6e3de] p-4">
              <legend className="px-1 text-sm font-semibold">Resend</legend>
              <p className="mb-3 text-sm text-[#6b665e]">
                Stored key:{" "}
                {resendMask ? <Badge tone="good">{isOwner ? resendMask : "Saved"}</Badge> : envKey ? <Badge tone="info">Using environment variable</Badge> : <Badge tone="warn">Not set</Badge>}
              </p>
              {isOwner ? (
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <TextInput
                    name="resendApiKey"
                    label={resendMask ? "Replace API key" : "API key"}
                    type="password"
                    autoComplete="off"
                    placeholder="re_…"
                    hint="Encrypted before it's saved and never shown again. Leave empty to keep the current key."
                  />
                  {resendMask && <Toggle name="clearResendKey" label="Remove stored key" />}
                </div>
              ) : (
                <p className="text-xs text-[#6b665e]">Only the owner can add or change API keys.</p>
              )}
            </fieldset>

            <fieldset className="rounded-md border border-[#e6e3de] p-4">
              <legend className="px-1 text-sm font-semibold">SMTP (only if not using Resend)</legend>
              <div className="grid gap-4 md:grid-cols-4">
                <TextInput name="smtpHost" label="Host" defaultValue={email.smtp.host} placeholder="smtp.mail.yahoo.com" wrapClass="md:col-span-2" />
                <TextInput name="smtpPort" label="Port" type="number" defaultValue={String(email.smtp.port)} />
                <div className="pt-6">
                  <Toggle name="smtpSecure" label="TLS on connect (port 465)" defaultChecked={email.smtp.secure} />
                </div>
                <TextInput name="smtpUser" label="Username" defaultValue={email.smtp.user} autoComplete="off" wrapClass="md:col-span-2" />
                {isOwner && (
                  <TextInput
                    name="smtpPassword"
                    label={email.smtp.password ? "Replace password" : "Password / app password"}
                    type="password"
                    autoComplete="off"
                    wrapClass="md:col-span-2"
                    hint={email.smtp.password ? "A password is stored (encrypted). Leave empty to keep it." : undefined}
                  />
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#6b665e]">
                Personal mailboxes such as Yahoo or Gmail need an app password, can only send as that mailbox&apos;s own address, and have low daily limits. Fine for
                staff notifications; not recommended for customer emails.
              </p>
            </fieldset>

            <div className="rounded-md border border-[#e6e3de] bg-[#faf9f7] p-4">
              <Toggle
                name="deliveryEnabled"
                label="Email delivery switched on"
                hint="Master switch. While off, submissions are still saved but no email is sent (each is logged as skipped)."
                defaultChecked={email.deliveryEnabled}
              />
            </div>
          </ActionForm>
        </Card>

        <Card title="Send a test email" description="Sends even while delivery is switched off, so you can check the setup first.">
          <ActionForm action={sendTestEmailAction} submitLabel="Send test" showCancel={false} disabled={!canEdit} compact>
            <TextInput name="to" label="Send to" type="email" defaultValue={user.email} required />
          </ActionForm>
          {email.lastTestAt && (
            <p className="mt-3 text-xs text-[#6b665e]">
              Last test {formatDateTime(email.lastTestAt)}: {email.lastTestOk ? <Badge tone="good">delivered to provider</Badge> : <Badge tone="bad">failed</Badge>}
            </p>
          )}
        </Card>

        <div id="log">
          <Card title="Delivery log" description="The last 30 emails. Message contents and customer addresses are never stored.">
            {log.length === 0 ? (
              <p className="text-sm text-[#6b665e]">No emails yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
                      <th className="py-2 pr-3 font-medium">When</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">To</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((l) => (
                      <tr key={l.id} className="border-b border-[#f3f1ed] align-top">
                        <td className="whitespace-nowrap py-2 pr-3 text-xs">{formatDateTime(l.createdAt)}</td>
                        <td className="py-2 pr-3">{l.template}</td>
                        <td className="py-2 pr-3 text-xs">{l.recipientSummary}</td>
                        <td className="py-2 pr-3">
                          <Badge tone={l.status === "sent" ? "good" : l.status === "failed" ? "bad" : l.status === "skipped" ? "warn" : "neutral"}>{l.status}</Badge>
                        </td>
                        <td className="py-2 text-xs text-[#6b665e]">{l.error ?? l.providerMessageId ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Sending-domain checklist (DNS)">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[#3a3733]">
            <li>In Resend, add the domain <strong>hotrockhove.com</strong> (or a subdomain such as send.hotrockhove.com).</li>
            <li>Add the DKIM and return-path records Resend shows to the DNS at Hostinger. Don&apos;t replace the existing MX records: they handle the mailboxes.</li>
            <li>Keep the existing SPF record for Hostinger mail; Resend&apos;s SPF lives on its return-path subdomain.</li>
            <li>DMARC is currently <code>p=none</code> with no reporting. Add a reporting address, then tighten to quarantine once everything passes.</li>
            <li>Wait until Resend shows the domain as verified, then send a test above.</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
