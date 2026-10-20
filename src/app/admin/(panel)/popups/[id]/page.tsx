import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { MediaField } from "@/components/admin/media-picker";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { deletePopupAction, savePopupAction } from "../actions";

export const metadata = { title: "Pop-up" };

/** Format a UTC date as a UK-local value for <input type="datetime-local">. */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export default async function PopupEditor({ params }: PageProps<"/admin/popups/[id]">) {
  const user = await requirePermission("content.view");
  const { id } = await params;
  const isNew = id === "new";
  const p = isNew ? null : await db.query.popups.findFirst({ where: eq(t.popups.id, id) }).catch(() => null);
  if (!isNew && !p) notFound();
  const forms = await db.select({ key: t.forms.key, name: t.forms.name }).from(t.forms).orderBy(asc(t.forms.name));
  const canEdit = can(user.role, "popups.edit");

  return (
    <>
      <PageHeader
        title={isNew ? "New pop-up" : p!.name}
        description={
          <Link href="/admin/popups" className="underline">
            ← All pop-ups
          </Link>
        }
      />
      <div className="mb-4">
        <Notice tone="info">Keep pop-ups rare and useful. A short delay (5 to 10 seconds) or scroll trigger interrupts visitors less than showing one immediately.</Notice>
      </div>
      <ActionForm action={savePopupAction} disabled={!canEdit} cancelHref="/admin/popups">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Card title="Content">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="name" label="Internal name" defaultValue={p?.name} required maxLength={100} />
            <Select
              name="template"
              label="Layout"
              defaultValue={p?.template ?? "image_top"}
              options={[
                { value: "image_top", label: "Image above text" },
                { value: "image_side", label: "Image beside text" },
                { value: "text_only", label: "Text only" },
              ]}
            />
          </div>
          <TextInput name="heading" label="Heading" defaultValue={p?.heading} required maxLength={160} wrapClass="mt-4" />
          <TextArea name="body" label="Text" defaultValue={p?.body} rows={3} maxLength={600} wrapClass="mt-4" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MediaField name="imageId" label="Image" defaultId={p?.imageId} type="image" />
            <Select
              name="formKey"
              label="Embedded form"
              defaultValue={p?.formKey ?? ""}
              options={[{ value: "", label: "None (use a button)" }, { value: "newsletter", label: "Newsletter sign-up" }, ...forms.map((f) => ({ value: f.key, label: f.name }))]}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
            <TextInput name="ctaLabel" label="Button text (when no form)" defaultValue={p?.ctaLabel} maxLength={40} />
            <TextInput name="ctaHref" label="Button link" defaultValue={p?.ctaHref} placeholder="/our-menus, https://…, or book" />
          </div>
        </Card>

        <Card title="When and where">
          <TextArea
            name="pages"
            label="Show on these pages"
            rows={2}
            defaultValue={p?.pages.join("\n") ?? "/"}
            hint="One path per line, e.g. / or /daisy. Leave empty for every page."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Select
              name="trigger"
              label="Trigger"
              defaultValue={p?.trigger ?? "delay"}
              options={[
                { value: "delay", label: "After a delay" },
                { value: "scroll", label: "After scrolling" },
                { value: "exit_intent", label: "When leaving (desktop only)" },
              ]}
            />
            <TextInput name="delaySeconds" label="Delay (seconds)" type="number" min={0} max={120} defaultValue={String(p?.delaySeconds ?? 5)} />
            <TextInput name="scrollPercent" label="Scroll depth (%)" type="number" min={5} max={100} defaultValue={String(p?.scrollPercent ?? 50)} />
            <Select
              name="frequency"
              label="How often"
              defaultValue={p?.frequency ?? "session"}
              options={[
                { value: "session", label: "Once per visit" },
                { value: "days", label: "Once every N days" },
                { value: "once", label: "Only once ever" },
              ]}
            />
            <TextInput name="frequencyDays" label="N days" type="number" min={1} max={365} defaultValue={String(p?.frequencyDays ?? 7)} />
            <TextInput name="priority" label="Priority (0 to 100)" type="number" min={0} max={100} defaultValue={String(p?.priority ?? 0)} hint="Higher wins when two match." />
            <TextInput name="startsAt" label="Start (UK time, optional)" type="datetime-local" defaultValue={toLocalInput(p?.startsAt ?? null)} />
            <TextInput name="endsAt" label="End (UK time, optional)" type="datetime-local" defaultValue={toLocalInput(p?.endsAt ?? null)} />
          </div>
          <div className="mt-4">
            <Toggle name="enabled" label="Switched on" defaultChecked={p?.enabled ?? false} />
          </div>
        </Card>
      </ActionForm>
      {p && canEdit && (
        <div className="mt-6">
          <ConfirmButton action={deletePopupAction} hidden={{ id: p.id }} label="Delete pop-up" question="Delete this pop-up and its statistics?" />
        </div>
      )}
    </>
  );
}
