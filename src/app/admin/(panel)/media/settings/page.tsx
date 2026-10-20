import Link from "next/link";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh, maskSecret } from "@/lib/settings";
import { ActionForm, Select, TextInput } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader } from "@/components/admin/ui";
import { saveStorageAction, testStorageAction } from "../actions";

export const metadata = { title: "Media storage" };

export default async function StorageSettings() {
  const user = await requirePermission("settings.view");
  const s = await getSettingFresh("storage");
  const canEdit = can(user.role, "settings.edit");
  const isOwner = can(user.role, "secrets.edit");
  const secret = maskSecret(s.cloudinary.apiSecret);

  return (
    <>
      <PageHeader
        title="Media storage"
        description={
          <Link href="/admin/media" className="underline">
            ← Media library
          </Link>
        }
      />
      <div className="space-y-6">
        <Notice tone="info">
          Cloudinary&apos;s free plan gives 25 credits a month (1 credit ≈ 1 GB storage, or 1 GB bandwidth, or 1,000 transformations) with a 100 MB limit per
          video. The site&apos;s current media is about 0.25 GB. Images are served resized and compressed, and videos only stream when a visitor presses play,
          to keep usage low. Watch usage in the Cloudinary dashboard after launch; upgrading is a paid decision for the owner.
        </Notice>
        <Card title="Provider">
          <ActionForm action={saveStorageAction} disabled={!canEdit}>
            <Select
              name="provider"
              label="Store new uploads in"
              defaultValue={s.provider}
              options={[
                { value: "cloudinary", label: "Cloudinary (production)" },
                { value: "local", label: "This computer (development only)" },
              ]}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="cloudName" label="Cloud name" defaultValue={s.cloudinary.cloudName} />
              <TextInput name="apiKey" label="API key" defaultValue={s.cloudinary.apiKey} autoComplete="off" />
              {isOwner ? (
                <TextInput
                  name="apiSecret"
                  label={secret ? "Replace API secret" : "API secret"}
                  type="password"
                  autoComplete="off"
                  hint={secret ? `Stored (${secret}). Leave empty to keep it.` : "Encrypted before it's saved and never shown again."}
                />
              ) : (
                <div>
                  <p className="mb-1.5 text-sm font-medium">API secret</p>
                  {secret ? <Badge tone="good">Saved</Badge> : <Badge tone="warn">Not set</Badge>} <span className="text-xs text-[#6b665e]">Only the owner can change it.</span>
                </div>
              )}
              <TextInput name="folder" label="Folder" defaultValue={s.cloudinary.folder} hint="All uploads go into this Cloudinary folder." />
            </div>
          </ActionForm>
        </Card>
        {canEdit && (
          <Card title="Test connection">
            <ActionForm action={testStorageAction} submitLabel="Test now" showCancel={false} compact>
              <p className="text-sm text-[#6b665e]">Checks the saved credentials with the provider. Save changes first.</p>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
