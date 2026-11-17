import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { MediaListField } from "@/components/admin/media-picker";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { deleteProductAction, saveProductAction } from "../actions";

export const metadata = { title: "Product" };

export default async function ProductEditor({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const user = await requirePermission("content.view");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const p = isNew ? null : await db.query.products.findFirst({ where: eq(t.products.id, id) }).catch(() => null);
  if (!isNew && !p) notFound();
  const canEdit = can(user.role, "menu.edit");

  return (
    <>
      <PageHeader
        title={isNew ? "Add product" : p!.name}
        description={
          <Link href="/admin/products" className="underline">
            ← All products
          </Link>
        }
      />
      {sp.created === "1" && (
        <div className="mb-4">
          <Notice tone="good">Product added.</Notice>
        </div>
      )}
      {p?.reviewNote && (
        <div className="mb-4">
          <Notice>
            <strong>Review note:</strong> {p.reviewNote}
          </Notice>
        </div>
      )}

      <ActionForm action={saveProductAction} disabled={!canEdit} cancelHref="/admin/products">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="name" label="Name" defaultValue={p?.name} required maxLength={120} placeholder="HR Mug" />
            <TextInput
              name="slug"
              label="Web address (slug)"
              defaultValue={p?.slug}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="hr-mug"
              hint="Lowercase letters, numbers and hyphens. Leave empty to create it from the name."
            />
          </div>
          <TextArea name="description" label="Description" defaultValue={p?.description} rows={5} maxLength={2000} wrapClass="mt-4" />
        </Card>

        <Card title="Price" description="Only the price shown is displayed on the site. The £ amount is stored for a future online shop.">
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput name="priceText" label="Price shown" defaultValue={p?.priceText} maxLength={60} placeholder="£12.99 or Available in the restaurant" hint="Leave empty to show no price." />
            <TextInput
              name="price"
              label="Price for the online shop (£, optional)"
              inputMode="decimal"
              defaultValue={p?.pricePence != null ? (p.pricePence / 100).toFixed(2) : ""}
              placeholder="0.00"
              hint="Not shown on the site yet."
            />
            <TextInput name="sku" label="SKU (optional)" defaultValue={p?.sku} maxLength={60} placeholder="HR-MUG-01" />
          </div>
        </Card>

        <Card title="Photos" description="Up to 8. The first photo is the main image.">
          <MediaListField name="imageIds" label="Photos" defaultIds={p?.imageIds ?? []} />
        </Card>

        <Card title="Display">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle name="available" label="Available" hint="Untick to show it as currently unavailable." defaultChecked={p?.available ?? true} />
            <Select
              name="status"
              label="Status"
              defaultValue={p?.status ?? "draft"}
              options={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft (not on the site)" },
              ]}
            />
          </div>
          {p?.reviewNote && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <Toggle name="markReviewed" label="Mark as reviewed (clears the review note)" />
            </div>
          )}
        </Card>
      </ActionForm>

      {p && can(user.role, "content.delete") && (
        <div className="mt-6">
          <ConfirmButton action={deleteProductAction} hidden={{ id: p.id }} label="Delete product" question={`Delete "${p.name}"?`} />
        </div>
      )}
    </>
  );
}
