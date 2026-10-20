import { turnstileConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { ActionForm, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader } from "@/components/admin/ui";
import { saveConsentAction, saveFeaturesAction } from "./actions";

export const metadata = { title: "Site settings" };

export default async function SiteSettings() {
  const user = await requirePermission("settings.view");
  const [f, consent] = await Promise.all([getSettingFresh("features"), getSettingFresh("consent")]);
  const canEdit = can(user.role, "settings.edit");

  return (
    <>
      <PageHeader title="Site settings" description="Switches for site-wide features. Business details and branding are under Business settings." />
      <div className="space-y-6">
        <ActionForm action={saveFeaturesAction} disabled={!canEdit}>
          <Card title="Maintenance mode" description="Shows a 'back soon' page to visitors. Signed-in staff can still browse the site.">
            <Toggle name="maintenanceMode" label="Maintenance mode on" defaultChecked={f.maintenanceMode} />
            <TextArea name="maintenanceMessage" label="Message" defaultValue={f.maintenanceMessage} rows={2} maxLength={300} wrapClass="mt-3" />
          </Card>
          <Card title="Announcement bar" description="A thin bar above the header for short news, e.g. holiday opening hours.">
            <Toggle name="announcementEnabled" label="Show announcement" defaultChecked={f.announcementEnabled} />
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <TextInput name="announcementText" label="Text" defaultValue={f.announcementText} maxLength={160} />
              <TextInput name="announcementHref" label="Link (optional)" defaultValue={f.announcementHref} placeholder="/daisy or book" />
            </div>
          </Card>
          <Card title="Google reviews (Trustindex)" description="The old site showed Google reviews through Trustindex. Paste the widget's script address from your Trustindex account. It loads only after a visitor accepts optional cookies.">
            <Toggle name="reviewsEnabled" label="Show reviews where a page has a Reviews section" defaultChecked={f.reviewsEnabled} />
            <TextInput name="reviewsEmbedSrc" label="Trustindex script URL" defaultValue={f.reviewsEmbedSrc} placeholder="https://cdn.trustindex.io/loader.js?…" wrapClass="mt-3" />
          </Card>
          <Card title="360° tour">
            <Notice>
              The old homepage embedded a 360° tour hosted on vr.3d66.com (labelled “RonGroup”). Keep this off until you&apos;ve confirmed the tour shows Hot Rock
              Hove and that you have permission to embed it.
            </Notice>
            <div className="mt-3">
              <Toggle name="vrTourEnabled" label="Allow the tour embed" defaultChecked={f.vrTourEnabled} />
              <TextInput name="vrTourUrl" label="Tour URL" defaultValue={f.vrTourUrl} wrapClass="mt-3" />
            </div>
          </Card>
        </ActionForm>

        <Card title="Cookies and analytics" description="The site uses one essential cookie for the visitor's choice. Optional content and analytics load only after 'Accept all'.">
          <ActionForm action={saveConsentAction} disabled={!canEdit} compact>
            <TextArea name="bannerText" label="Cookie banner text" defaultValue={consent.bannerText} rows={3} maxLength={400} />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                name="analyticsProvider"
                label="Analytics"
                defaultValue={consent.analyticsProvider}
                options={[
                  { value: "none", label: "None" },
                  { value: "ga4", label: "Google Analytics 4" },
                  { value: "plausible", label: "Plausible" },
                ]}
              />
              <TextInput name="analyticsId" label="Measurement ID / site" defaultValue={consent.analyticsId} placeholder="G-XXXXXXX or hotrockhove.com" />
            </div>
          </ActionForm>
        </Card>

        <Card title="Spam protection">
          <p className="text-sm">
            Cloudflare Turnstile: {turnstileConfigured() ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Not configured</Badge>}
          </p>
          <p className="mt-2 text-xs text-[#6b665e]">
            Turnstile keys are platform settings, set as Vercel environment variables (NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY). Every form also
            has a hidden trap field and per-connection rate limits.
          </p>
        </Card>
      </div>
    </>
  );
}
