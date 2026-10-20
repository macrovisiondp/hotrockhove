import Link from "next/link";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh, maskSecret } from "@/lib/settings";
import { s3PublicBase } from "@/lib/storage";
import { env } from "@/lib/env";
import { ActionForm, Select, TextInput } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader } from "@/components/admin/ui";
import { saveStorageAction, testStorageAction } from "../actions";

export const metadata = { title: "Media storage" };

export default async function StorageSettings() {
  const user = await requirePermission("settings.view");
  const s = await getSettingFresh("storage");
  const canEdit = can(user.role, "settings.edit");
  const isOwner = can(user.role, "secrets.edit");
  const secret = maskSecret(s.s3.secretAccessKey);
  const prefix = s.s3.prefix || "hotrockhove";
  const bucket = s.s3.bucket || "YOUR-BUCKET";
  const origin = env().APP_URL;

  const policy = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [{ Sid: "PublicReadSiteMedia", Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: `arn:aws:s3:::${bucket}/${prefix}/*` }],
    },
    null,
    2,
  );
  const cors = JSON.stringify(
    [{ AllowedOrigins: [origin, "https://hotrockhove.com", "https://www.hotrockhove.com"], AllowedMethods: ["PUT"], AllowedHeaders: ["Content-Type", "Cache-Control"], MaxAgeSeconds: 3000 }],
    null,
    2,
  );
  const iam = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource: `arn:aws:s3:::${bucket}/${prefix}/*` },
        { Effect: "Allow", Action: ["s3:ListBucket"], Resource: `arn:aws:s3:::${bucket}` },
      ],
    },
    null,
    2,
  );

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
        <Card title="Amazon S3" description="Photos and videos are stored in your S3 bucket and served publicly (directly, or through a CloudFront CDN if you add one).">
          <ActionForm action={saveStorageAction} disabled={!canEdit}>
            <Select
              name="provider"
              label="Store new uploads in"
              defaultValue={s.provider}
              options={[
                { value: "s3", label: "Amazon S3 (production)" },
                { value: "local", label: "This computer (development only)" },
                { value: "cloudinary", label: "Cloudinary (alternative)" },
              ]}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="s3Bucket" label="Bucket name" defaultValue={s.s3.bucket} placeholder="hotrockhove-media" />
              <TextInput name="s3Region" label="Region" defaultValue={s.s3.region} placeholder="eu-west-2" hint="eu-west-2 is London." />
              <TextInput name="s3AccessKeyId" label="Access key ID" defaultValue={s.s3.accessKeyId} autoComplete="off" readOnly={!isOwner} />
              {isOwner ? (
                <TextInput
                  name="s3SecretAccessKey"
                  label={secret ? "Replace secret access key" : "Secret access key"}
                  type="password"
                  autoComplete="off"
                  hint={secret ? `Stored (${secret}). Leave empty to keep it.` : "Encrypted before it's saved and never shown again."}
                />
              ) : (
                <div>
                  <p className="mb-1.5 text-sm font-medium">Secret access key</p>
                  {secret ? <Badge tone="good">Saved</Badge> : <Badge tone="warn">Not set</Badge>} <span className="text-xs text-[#6b665e]">Only the owner can change keys.</span>
                </div>
              )}
              <TextInput name="s3Prefix" label="Folder in the bucket" defaultValue={s.s3.prefix} hint="Everything the site uploads goes under this folder." />
              <TextInput
                name="s3PublicBaseUrl"
                label="Public URL / CDN (optional)"
                defaultValue={s.s3.publicBaseUrl}
                placeholder="https://media.hotrockhove.com"
                hint={`Leave empty to serve from ${s3PublicBase(s)}. Add a CloudFront domain here for faster, cheaper delivery.`}
              />
              <TextInput name="s3Endpoint" label="Custom endpoint (S3-compatible only)" defaultValue={s.s3.endpoint} placeholder="Leave empty for AWS" />
            </div>
            {/* Cloudinary values are kept as an alternative provider. */}
            <input type="hidden" name="cloudName" value={s.cloudinary.cloudName} />
            <input type="hidden" name="apiKey" value={s.cloudinary.apiKey} />
            <input type="hidden" name="folder" value={s.cloudinary.folder} />
          </ActionForm>
        </Card>

        {canEdit && (
          <Card title="Test" description="Uploads a tiny file, reads it back from the public URL, then deletes it. Save changes first.">
            <ActionForm action={testStorageAction} submitLabel="Test now" showCancel={false} compact>
              <span />
            </ActionForm>
          </Card>
        )}

        <Card title="Bucket setup (one-time, in the AWS console)">
          <ol className="list-decimal space-y-4 pl-5 text-sm text-[#3a3733]">
            <li>
              Create the bucket in <strong>eu-west-2 (London)</strong>. Keep <em>Object Ownership: bucket owner enforced</em> (no ACLs). Under <em>Block public
              access</em>, untick only &quot;Block public access via new/any public bucket policies&quot;. Site media is meant to be public; nothing private is
              stored here.
            </li>
            <li>
              <strong>Bucket policy</strong>: lets anyone read files in the site folder only:
              <pre className="mt-2 overflow-x-auto rounded bg-[#1c1b19] p-3 text-xs text-[#e8e4dd]">{policy}</pre>
            </li>
            <li>
              <strong>CORS</strong> (Permissions → CORS) so the admin can upload videos directly from the browser:
              <pre className="mt-2 overflow-x-auto rounded bg-[#1c1b19] p-3 text-xs text-[#e8e4dd]">{cors}</pre>
            </li>
            <li>
              Create an <strong>IAM user</strong> just for this website with this policy, then create an access key for it and paste it above:
              <pre className="mt-2 overflow-x-auto rounded bg-[#1c1b19] p-3 text-xs text-[#e8e4dd]">{iam}</pre>
            </li>
            <li>
              Optional: put <strong>CloudFront</strong> in front of the bucket (origin access control, so the bucket can then be private) and enter its domain as
              the public URL. This is cheaper bandwidth and faster delivery.
            </li>
          </ol>
          <div className="mt-4">
            <Notice tone="info">
              Costs: S3 storage for the current media (about 0.25 GB) is a few pence a month; data transfer out is charged per GB after AWS&apos;s monthly free
              allowance. Images are resized by the website before delivery, and videos only stream when a visitor presses play.
            </Notice>
          </div>
        </Card>
      </div>
    </>
  );
}
