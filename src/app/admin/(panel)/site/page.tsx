import Link from "next/link";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { ActionForm, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { Card, PageHeader } from "@/components/admin/ui";
import { refreshSiteCacheAction, saveConsentAction, saveFeaturesAction } from "./actions";

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
          <Card
            title="3D tour"
            description="The 360° venue tour shown by a page's 3D tour section. It's hosted by a third party (vr.3d66.com), so it loads after cookie consent or when the visitor clicks to start it."
          >
            <Toggle name="vrTourEnabled" label="Show the tour" defaultChecked={f.vrTourEnabled} />
            <TextInput name="vrTourUrl" label="Tour URL" defaultValue={f.vrTourUrl} placeholder="https://vr.3d66.com/vr/index_detail_….asp" wrapClass="mt-3" />
          </Card>
          <Card
            title="Homepage sounds"
            description="A looping sizzle and a moo when visitors open the homepage, as on the old site. Browsers usually hold sound back until the visitor taps or clicks; a speaker button lets them mute it."
          >
            <Toggle name="homeSoundsEnabled" label="Play homepage sounds" defaultChecked={f.homeSoundsEnabled} />
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <TextInput name="sizzleSoundUrl" label="Sizzle loop (MP3 URL)" defaultValue={f.sizzleSoundUrl} />
              <TextInput name="mooSoundUrl" label="Moo (MP3 URL)" defaultValue={f.mooSoundUrl} />
            </div>
          </Card>
        </ActionForm>

        <Card title="Refresh site content" description="The site keeps content cached for speed, and admin saves refresh it automatically. Use this if a change made outside the admin isn't showing.">
          <ActionForm action={refreshSiteCacheAction} disabled={!canEdit} submitLabel="Refresh now" showCancel={false} compact>
            <p className="text-sm text-[#6b665e]">Safe to use at any time; it doesn&apos;t change any content.</p>
          </ActionForm>
        </Card>

        <Card title="Cookie banner" description="The site uses one essential cookie for the visitor's choice. Optional content (maps, tour, analytics) loads only after 'Accept all'.">
          <ActionForm action={saveConsentAction} disabled={!canEdit} compact>
            <TextArea name="bannerText" label="Cookie banner text" defaultValue={consent.bannerText} rows={3} maxLength={400} />
            <p className="text-sm text-[#6b665e]">
              Google Analytics is set up under{" "}
              <Link href="/admin/connections" className="underline">
                Connections
              </Link>
              .
            </p>
          </ActionForm>
        </Card>

      </div>
    </>
  );
}
