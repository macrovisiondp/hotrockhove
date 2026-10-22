import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { DAY_LABELS, DAYS, getSettingFresh } from "@/lib/settings";
import { ActionForm, TextArea, TextInput } from "@/components/admin/form";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { HoursEditor } from "./hours-editor";
import { saveBrandAction, saveBusinessAction } from "./actions";

export const metadata = { title: "Business settings" };

export default async function BusinessPage() {
  const user = await requirePermission("settings.view");
  const [b, brand] = await Promise.all([getSettingFresh("business"), getSettingFresh("brand")]);
  const readOnly = !can(user.role, "settings.edit");
  const hours = DAYS.map((day) => b.hours.find((h) => h.day === day) ?? { day, closed: false, opens: "12:00", closes: "22:00" });

  return (
    <>
      <PageHeader
        title="Business settings"
        description="The single source for the restaurant's public details. Every page, the footer, contact forms, emails and search-engine data read from here."
      />
      {readOnly && (
        <div className="mb-4">
          <Notice tone="info">You can view these settings. Only owners and admins can change them.</Notice>
        </div>
      )}

      <ActionForm action={saveBusinessAction} disabled={readOnly}>
        <Card title="Business" description="Name and short description used in the footer, page titles and emails.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="name" label="Business name" defaultValue={b.name} required maxLength={80} />
            <TextInput name="tagline" label="Tagline" defaultValue={b.tagline} maxLength={160} hint="Optional. Shown in search results and the footer." />
          </div>
          <TextArea name="footerBlurb" label="Footer text" defaultValue={b.footerBlurb} rows={2} maxLength={300} wrapClass="mt-4" hint="Optional short paragraph under the footer logo." />
        </Card>

        <Card title="Contact details" description="Leave a field empty to hide it everywhere on the site.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="phone" label="Public phone number" type="tel" defaultValue={b.phone} hint="Shown exactly as typed. Tap-to-call uses the digits." />
            <TextInput name="email" label="Public email address" type="email" defaultValue={b.email} hint="Shown on the site. The inbox that receives enquiries is set under Connections." />
            <TextInput name="addressLine1" label="Address line 1" defaultValue={b.addressLine1} />
            <TextInput name="addressLine2" label="Address line 2" defaultValue={b.addressLine2} />
            <TextInput name="town" label="Town / city" defaultValue={b.town} />
            <TextInput name="postcode" label="Postcode" defaultValue={b.postcode} maxLength={12} />
            <TextInput name="country" label="Country" defaultValue={b.country} />
            <TextInput name="mapUrl" label="Map / directions link" type="url" defaultValue={b.mapUrl} placeholder="https://www.google.com/maps/…" hint="Used by the Directions buttons." />
          </div>
        </Card>

        <div id="hours">
          <Card title="Opening hours" description="Shown in the footer, on the contact page and in Google's restaurant data. Use 24-hour times.">
            <HoursEditor
              enabled={b.hours.length > 0}
              days={hours.map((h) => ({ ...h, label: DAY_LABELS[h.day] }))}
            />
            <TextInput name="hoursNote" label="Note under the hours" defaultValue={b.hoursNote} maxLength={200} wrapClass="mt-4" hint='Optional, e.g. "Last orders 30 minutes before closing".' />
          </Card>
        </div>

        <div id="booking">
          <Card title="Book Table" description="Booking is handled by a separate system. Paste its web address here when it's ready.">
            <TextInput
              name="bookTableUrl"
              label="Booking system URL"
              type="url"
              defaultValue={b.bookTableUrl}
              placeholder="https://…"
              hint="When empty, Book Table opens the table-request form (if enabled), otherwise calls the phone number."
            />
          </Card>
        </div>

        <div id="social">
          <Card title="Social media" description="Only official accounts. Leave empty to hide the icon.">
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput name="instagramUrl" label="Instagram" type="url" defaultValue={b.instagramUrl} />
              <TextInput name="facebookUrl" label="Facebook" type="url" defaultValue={b.facebookUrl} />
              <TextInput name="tiktokUrl" label="TikTok" type="url" defaultValue={b.tiktokUrl} />
            </div>
          </Card>
        </div>
      </ActionForm>

      <div className="mt-8" id="brand">
        <Card title="Logo, icon and brand colour">
          <ActionForm action={saveBrandAction} disabled={readOnly} compact>
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput name="logoUrl" label="Logo (white, transparent)" defaultValue={brand.logoUrl} hint="A /brand/… file, or the https:// address of an image in Media." />
              <TextInput name="faviconUrl" label="Browser icon" defaultValue={brand.faviconUrl} hint="Square PNG, at least 192×192." />
              <TextInput name="accentColour" label="Accent colour" defaultValue={brand.accentColour} pattern="#[0-9a-fA-F]{6}" hint="Buttons and highlights. Keep enough contrast with dark text." />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
