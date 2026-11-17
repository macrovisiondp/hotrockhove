import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { DEFAULT_ACK_BODY, DEFAULT_ACK_SUBJECT, parseFields } from "@/domain/forms/fields";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { FieldsEditor } from "@/components/admin/fields-editor";
import { Card, PageHeader } from "@/components/admin/ui";
import { saveFormAction } from "../actions";

export const metadata = { title: "Edit form" };

export default async function EditForm({ params }: PageProps<"/admin/forms/[key]">) {
  const user = await requirePermission("settings.view");
  const { key } = await params;
  const form = await db.query.forms.findFirst({ where: eq(t.forms.key, key) });
  if (!form) notFound();
  const [{ n }] = await db.select({ n: count() }).from(t.formSubmissions).where(eq(t.formSubmissions.formKey, key));
  const fields = parseFields(form.fields);

  return (
    <>
      <PageHeader
        title={form.name}
        description={
          <Link href="/admin/forms" className="underline">
            ← All forms
          </Link>
        }
      />
      <ActionForm action={saveFormAction} disabled={!can(user.role, "forms.edit")}>
        <input type="hidden" name="key" value={form.key} />
        <Card title="General">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="name" label="Form name" defaultValue={form.name} required maxLength={80} />
            <TextInput name="submitLabel" label="Button text" defaultValue={form.submitLabel} required maxLength={40} />
          </div>
          <TextArea name="successMessage" label="Message shown after sending" defaultValue={form.successMessage} rows={3} maxLength={1000} wrapClass="mt-4" />
          <div className="mt-4">
            <Toggle name="enabled" label="Form is switched on" defaultChecked={form.enabled} hint="When off, the page shows a 'not available' message with the phone number." />
          </div>
        </Card>

        <Card title="Fields" description="Spam protection (hidden trap field, rate limits and Turnstile when configured) is added automatically.">
          <FieldsEditor initial={fields} submissionsExist={n > 0} />
        </Card>

        <Card title="Staff notification">
          <Toggle name="notifyAdmin" label="Email staff when this form is sent" defaultChecked={form.notifyAdmin} />
          <p className="mt-3 text-sm text-[#5f5a52]">
            Sent to everyone ticked for this form (or for all notifications) in{" "}
            <Link href="/admin/email" className="underline">
              Email &amp; notifications
            </Link>
            .
          </p>
          <TextArea
            name="recipients"
            label="Extra recipients for this form only (optional)"
            rows={2}
            defaultValue={form.recipients.join("\n")}
            wrapClass="mt-4"
            hint="Also emailed, in addition to the list above. One address per line."
          />
          <TextInput name="adminSubject" label="Subject" defaultValue={form.adminSubject} maxLength={200} wrapClass="mt-4" hint="Use {{field_name}} to include an answer, e.g. {{name}}." />
        </Card>

        <Card
          title="Confirmation to the customer"
          description="Everyone who sends this form gets a branded confirmation email with a copy of their details (the form needs an Email field). Leave the wording empty to use the standard message."
        >
          <TextInput name="ackSubject" label="Subject" defaultValue={form.ackSubject} placeholder={DEFAULT_ACK_SUBJECT} maxLength={200} />
          <TextArea
            name="ackBody"
            label="Message"
            defaultValue={form.ackBody}
            placeholder={DEFAULT_ACK_BODY}
            rows={8}
            maxLength={5000}
            wrapClass="mt-4"
            hint="Plain text; a blank line starts a new paragraph. Placeholders: {{greeting}} (“Hello Sam,”), {{firstName}}, {{brandName}}, {{formName}} and any {{field_name}}."
          />
        </Card>

        <Card title="Data retention">
          <TextInput
            name="retentionDays"
            label="Delete submissions after (days)"
            type="number"
            min={30}
            max={3650}
            defaultValue={form.retentionDays ? String(form.retentionDays) : ""}
            hint="Checked daily. Leave empty to keep until deleted manually (not recommended for personal data)."
          />
        </Card>
      </ActionForm>
    </>
  );
}
