import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { MediaField } from "@/components/admin/media-picker";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { deleteOfferAction, saveOfferAction } from "../actions";

export const metadata = { title: "Offer" };

export default async function OfferEditor({ params }: PageProps<"/admin/offers/[id]">) {
  const user = await requirePermission("content.view");
  const { id } = await params;
  const isNew = id === "new";
  const o = isNew ? null : await db.query.offers.findFirst({ where: eq(t.offers.id, id) }).catch(() => null);
  if (!isNew && !o) notFound();
  return (
    <>
      <PageHeader
        title={isNew ? "New offer" : o!.title}
        description={
          <Link href="/admin/offers" className="underline">
            ← All offers
          </Link>
        }
      />
      {o?.reviewNote && (
        <div className="mb-4">
          <Notice>
            <strong>Review note:</strong> {o.reviewNote}
          </Notice>
        </div>
      )}
      <ActionForm action={saveOfferAction} disabled={!can(user.role, "content.edit")} cancelHref="/admin/offers">
        {o && <input type="hidden" name="id" value={o.id} />}
        <input type="hidden" name="sortOrder" value={String(o?.sortOrder ?? 0)} />
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="title" label="Title" defaultValue={o?.title} required maxLength={80} />
            <TextInput name="tagline" label="Tagline" defaultValue={o?.tagline} maxLength={160} />
          </div>
          <TextArea name="body" label="Description" defaultValue={o?.body} rows={5} maxLength={1500} wrapClass="mt-4" hint="Line breaks are kept. **bold** and *italic* work." />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput name="priceText" label="Price shown" defaultValue={o?.priceText} placeholder="£19.99" maxLength={40} />
            <TextInput name="promoCode" label="Booking code" defaultValue={o?.promoCode} maxLength={30} />
            <MediaField name="imageId" label="Image (optional)" defaultId={o?.imageId} type="image" />
          </div>
        </Card>
        <Card title="Publishing">
          <div className="grid gap-4 md:grid-cols-4">
            <Select name="status" label="Status" defaultValue={o?.status ?? "published"} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }]} />
            <Select name="stage" label="Show as" defaultValue={o?.stage ?? "current"} options={[{ value: "current", label: "Current offer" }, { value: "upcoming", label: "Coming soon" }]} />
            <TextInput name="startsOn" label="Start date (optional)" type="date" defaultValue={o?.startsOn ?? ""} />
            <TextInput name="endsOn" label="End date (optional)" type="date" defaultValue={o?.endsOn ?? ""} />
          </div>
          {o?.reviewNote && (
            <div className="mt-4">
              <Toggle name="markReviewed" label="Mark as reviewed (clears the review note)" />
            </div>
          )}
        </Card>
      </ActionForm>
      {o && can(user.role, "content.delete") && (
        <div className="mt-6">
          <ConfirmButton action={deleteOfferAction} hidden={{ id: o.id }} label="Delete offer" question={`Delete "${o.title}"?`} />
        </div>
      )}
    </>
  );
}
