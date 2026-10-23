import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh, maskSecret } from "@/lib/settings";
import { env } from "@/lib/env";
import { twilioReady } from "@/lib/sms/twilio";
import { turnstileKeys } from "@/lib/turnstile";
import { ActionForm, ConfirmButton, TextArea, TextInput } from "@/components/admin/form";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { sendTestEmailAction } from "../email/actions";
import {
  disconnectEmailAction,
  disconnectTwilioAction,
  saveAnalyticsAction,
  saveBookingAction,
  saveEmailConnectionAction,
  saveTurnstileAction,
  saveTwilioAction,
  sendTestSmsAction,
} from "./actions";

export const metadata = { title: "Connections" };

function Status({ on, onText = "Connected", offText = "Not connected" }: { on: boolean; onText?: string; offText?: string }) {
  return on ? <Badge tone="good">{onText}</Badge> : <Badge tone="neutral">{offText}</Badge>;
}

export default async function ConnectionsPage() {
  const user = await requirePermission("settings.view");
  const [email, notifications, turnstile, business, consent, tsKeys, twilio] = await Promise.all([
    getSettingFresh("email"),
    getSettingFresh("notifications"),
    getSettingFresh("turnstile"),
    getSettingFresh("business"),
    getSettingFresh("consent"),
    turnstileKeys(true),
    getSettingFresh("twilio"),
  ]);
  const smsOn = twilioReady(twilio);
  const tokenMask = maskSecret(twilio.authToken);
  const canEdit = can(user.role, "settings.edit");
  const isOwner = can(user.role, "secrets.edit");
  const emailOn = email.deliveryEnabled && Boolean(email.resendApiKey && email.fromAddress);
  const keyMask = maskSecret(email.resendApiKey);
  const secretMask = maskSecret(turnstile.secretKey);
  const keepHint = (mask: string | null) => (mask ? `Saved (ends ${mask.replace(/^•+/, "")}). Leave empty to keep it.` : undefined);

  return (
    <>
      <PageHeader title="Connections" description="Enter your account details for each service and press Save. Changes take effect straight away." />
      <div className="space-y-6">
        <Card title={<span className="flex items-center gap-2">Email (Resend) <Status on={emailOn} /></span>} description="Sends enquiry notifications to you and confirmation emails to customers.">
          <ActionForm action={saveEmailConnectionAction} disabled={!canEdit} compact>
            <TextInput
              name="resendApiKey"
              label="Resend API key"
              type="password"
              autoComplete="off"
              placeholder={keyMask ? "••••••••" : "re_…"}
              hint={keepHint(keyMask) ?? "From resend.com → API Keys. The sending domain must be verified in Resend."}
              disabled={!isOwner}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="fromAddress" label="Send emails from" type="email" defaultValue={email.fromAddress} placeholder="no-reply@hotrockhove.com" hint="An address on your Resend-verified domain." />
              <TextInput name="fromName" label="Sender name" defaultValue={email.fromName} placeholder="Hot Rock Hove" />
            </div>
            <TextArea
              name="recipients"
              label="Send enquiries to"
              defaultValue={notifications.recipients.join("\n")}
              rows={2}
              placeholder="hello@hotrockhove.com"
              hint="Where new contact, fan-club and table-request messages are emailed. One address per line."
            />
          </ActionForm>
          {emailOn && (
            <div className="mt-5 flex flex-wrap items-end gap-6 border-t border-[#f0ede8] pt-5">
              <div className="min-w-[260px] flex-1">
                <ActionForm action={sendTestEmailAction} submitLabel="Send a test email" showCancel={false} compact>
                  <TextInput name="to" label="Send a test email to" type="email" defaultValue={notifications.recipients[0] ?? ""} />
                </ActionForm>
              </div>
              {isOwner && <ConfirmButton action={disconnectEmailAction} label="Disconnect" confirmLabel="Yes, disconnect" question="Stop sending emails and remove the API key?" className="admin-btn admin-btn-secondary" />}
            </div>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2">Text messages (Twilio) <Status on={smsOn} /></span>}
          description="Sends marketing text messages from Admin → Marketing. Find these details in the Twilio Console (console.twilio.com) under Account Info."
        >
          <ActionForm action={saveTwilioAction} disabled={!canEdit} compact>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="accountSid" label="Account SID" defaultValue={twilio.accountSid} autoComplete="off" placeholder="AC…" disabled={!isOwner} />
              <TextInput name="authToken" label="Auth Token" type="password" autoComplete="off" placeholder={tokenMask ? "••••••••" : ""} hint={keepHint(tokenMask)} disabled={!isOwner} />
              <TextInput
                name="sender"
                label="Send texts from"
                defaultValue={twilio.sender}
                placeholder="+447700900123 or HotRock"
                hint="Your Twilio phone number (with +44), a sender name of up to 11 letters (customers can't reply to it), or a Messaging Service SID (MG…)."
                disabled={!isOwner}
              />
              <TextInput name="optOutText" label="Opt-out line added to every text" defaultValue={twilio.optOutText} maxLength={60} hint="Required for marketing texts. Keep it if you send from a phone number." />
            </div>
            <p className="text-xs text-[#6b665e]">
              So that STOP replies are recorded automatically: in Twilio, open your phone number → Messaging → &quot;A message comes in&quot; → Webhook, and paste{" "}
              <code className="rounded bg-[#f3f1ed] px-1 py-0.5">{env().APP_URL}/api/twilio/inbound</code> (HTTP POST).
            </p>
          </ActionForm>
          {smsOn && (
            <div className="mt-5 flex flex-wrap items-end gap-6 border-t border-[#f0ede8] pt-5">
              <div className="min-w-[260px] flex-1">
                <ActionForm action={sendTestSmsAction} submitLabel="Send a test text" showCancel={false} compact>
                  <TextInput name="to" label="Send a test text to" type="tel" placeholder="07700 900123" />
                </ActionForm>
              </div>
              {isOwner && <ConfirmButton action={disconnectTwilioAction} label="Disconnect" confirmLabel="Yes, disconnect" question="Stop sending texts and remove the Twilio details?" className="admin-btn admin-btn-secondary" />}
            </div>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2">Spam protection (Cloudflare Turnstile) <Status on={Boolean(tsKeys.source)} /></span>}
          description="Stops bots sending forms. Create a free widget at dash.cloudflare.com → Turnstile for hotrockhove.com (and hotrockhove.vercel.app), then paste both keys."
        >
          <ActionForm action={saveTurnstileAction} disabled={!canEdit} compact>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="siteKey" label="Site key" defaultValue={turnstile.siteKey} autoComplete="off" placeholder="0x4AAAAAAA…" disabled={!isOwner} />
              <TextInput name="secretKey" label="Secret key" type="password" autoComplete="off" placeholder={secretMask ? "••••••••" : "0x4AAAAAAA…"} hint={keepHint(secretMask)} disabled={!isOwner} />
            </div>
            {tsKeys.source === "environment" && <p className="text-xs text-[#6b665e]">Currently using keys set on the server. Keys saved here take priority.</p>}
            <p className="text-xs text-[#6b665e]">To turn it off, clear the site key and save.</p>
          </ActionForm>
        </Card>

        <Card title={<span className="flex items-center gap-2">Booking system <Status on={Boolean(business.bookTableUrl)} onText="Linked" offText="Not linked" /></span>} description="The web address of your online booking page. Every Book Table button opens it.">
          <ActionForm action={saveBookingAction} disabled={!canEdit} compact>
            <TextInput name="bookTableUrl" label="Booking page address" type="url" defaultValue={business.bookTableUrl} placeholder="https://…" hint="Leave empty to use the table-request form instead." />
          </ActionForm>
        </Card>

        <Card
          title={<span className="flex items-center gap-2">Google Analytics <Status on={consent.analyticsProvider === "ga4" && Boolean(consent.analyticsId)} /></span>}
          description="Visitor statistics. Only counts visitors who accept cookies."
        >
          <ActionForm action={saveAnalyticsAction} disabled={!canEdit} compact>
            <TextInput name="analyticsId" label="Measurement ID" defaultValue={consent.analyticsProvider === "ga4" ? consent.analyticsId : ""} placeholder="G-XXXXXXXXXX" hint="From Google Analytics → Admin → Data streams. Leave empty to turn off." />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
