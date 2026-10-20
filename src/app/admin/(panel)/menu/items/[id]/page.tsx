import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, Select, TextArea, TextInput, Toggle } from "@/components/admin/form";
import { MediaField } from "@/components/admin/media-picker";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { deleteItemAction, saveItemAction } from "../../actions";

export const metadata = { title: "Menu item" };

export default async function MenuItemPage({ params, searchParams }: PageProps<"/admin/menu/items/[id]">) {
  const user = await requirePermission("content.view");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const item = isNew ? null : await db.query.menuItems.findFirst({ where: eq(t.menuItems.id, id) }).catch(() => null);
  if (!isNew && !item) notFound();
  const cats = await db.select({ id: t.menuCategories.id, name: t.menuCategories.name }).from(t.menuCategories).orderBy(asc(t.menuCategories.sortOrder));
  const canEdit = can(user.role, "menu.edit");
  const unreadable = item?.prices.some((p) => p.amountPence === null) ?? false;
  const priceRows = [0, 1, 2].map((i) => item?.prices[i]);

  return (
    <>
      <PageHeader
        title={isNew ? "Add menu item" : item!.name}
        description={
          <Link href="/admin/menu" className="underline">
            ← Back to the menu
          </Link>
        }
      />
      {sp.created === "1" && (
        <div className="mb-4">
          <Notice tone="good">Item added to the menu.</Notice>
        </div>
      )}
      {item?.reviewNote && (
        <div className="mb-4">
          <Notice>
            <strong>Review note:</strong> {item.reviewNote}
          </Notice>
        </div>
      )}

      <ActionForm action={saveItemAction} disabled={!canEdit} cancelHref="/admin/menu">
        {item && <input type="hidden" name="id" value={item.id} />}
        <Card>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <TextInput name="name" label="Name" defaultValue={item?.name} required maxLength={120} />
            <Select
              name="categoryId"
              label="Category"
              defaultValue={item?.categoryId ?? cats[0]?.id}
              options={cats.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <TextArea name="description" label="Description" defaultValue={item?.description} rows={3} maxLength={1000} wrapClass="mt-4" />
        </Card>

        <Card title="Price" description="Use one row for a single price. Add a label to each row for sizes (e.g. 330ml / 750ml).">
          {unreadable && (
            <div className="mb-4">
              <Notice>
                The old site showed this price as <strong>&quot;{item!.sourcePriceText}&quot;</strong>, which isn&apos;t a valid price, so the site displays that text
                exactly. Enter the correct price below to fix it, or tick &quot;keep showing the original text&quot;.
              </Notice>
            </div>
          )}
          <div className="space-y-3">
            {priceRows.map((p, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-[1fr_160px]">
                <TextInput name={`price.${i}.label`} label={i === 0 ? "Size label (optional)" : `Size label ${i + 1}`} defaultValue={p?.label ?? ""} placeholder={i === 0 ? "" : "e.g. 750ml"} />
                <TextInput
                  name={`price.${i}.amount`}
                  label={i === 0 ? "Price (£)" : `Price ${i + 1} (£)`}
                  inputMode="decimal"
                  defaultValue={p && p.amountPence !== null ? (p.amountPence / 100).toFixed(2) : ""}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          {unreadable && (
            <div className="mt-3">
              <Toggle name="keepSourcePrice" label={`Keep showing the original text ("${item!.sourcePriceText}") if no price is entered`} defaultChecked />
            </div>
          )}
        </Card>

        <Card title="Display">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Toggle name="available" label="Available" hint="Untick to hide it temporarily (e.g. sold out, seasonal)." defaultChecked={item?.available ?? true} />
              <Toggle name="featured" label="Featured" hint="Shown in the homepage menu highlights." defaultChecked={item?.featured ?? false} />
              <Select
                name="status"
                label="Status"
                defaultValue={item?.status ?? "published"}
                options={[
                  { value: "published", label: "Published" },
                  { value: "draft", label: "Draft (not on the site)" },
                ]}
              />
            </div>
            <MediaField name="imageId" label="Photo (optional)" defaultId={item?.imageId} type="image" hint="Used beside menu highlights." />
          </div>
          {item?.reviewNote && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <Toggle name="markReviewed" label="Mark as reviewed (clears the review note)" />
            </div>
          )}
        </Card>
      </ActionForm>

      {item && can(user.role, "content.delete") && (
        <div className="mt-6">
          <ConfirmButton action={deleteItemAction} hidden={{ id: item.id }} label="Delete item" question={`Delete "${item.name}" from the menu?`} />
        </div>
      )}
    </>
  );
}
