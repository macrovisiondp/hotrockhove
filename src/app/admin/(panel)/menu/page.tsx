import Link from "next/link";
import { asc, ne } from "drizzle-orm";
import { ArrowDown, ArrowUp, Flag } from "@phosphor-icons/react/dist/ssr";
import { db, t } from "@/db";
import { formatPrices } from "@/domain/content";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, InlineAction, Select, TextInput } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader } from "@/components/admin/ui";
import { deleteCategoryAction, moveCategoryAction, moveItemAction, saveCategoryAction } from "./actions";

export const metadata = { title: "Menu" };

export default async function MenuAdmin({ searchParams }: PageProps<"/admin/menu">) {
  const user = await requirePermission("content.view");
  const sp = await searchParams;
  const flaggedOnly = sp.flagged === "1";
  const canEdit = can(user.role, "menu.edit");
  const canDelete = can(user.role, "content.delete");

  const [cats, items, flagged] = await Promise.all([
    db.select().from(t.menuCategories).orderBy(asc(t.menuCategories.sortOrder)),
    db.select().from(t.menuItems).orderBy(asc(t.menuItems.sortOrder)),
    db.select({ id: t.menuItems.id }).from(t.menuItems).where(ne(t.menuItems.reviewNote, "")),
  ]);

  return (
    <>
      <PageHeader
        title="Menu"
        description="Categories, dishes and prices shown on the Our Menu page and in menu highlights. Prices were imported exactly as they appeared on the old site."
        actions={
          canEdit && (
            <Link href="/admin/menu/items/new" className="admin-btn admin-btn-primary">
              Add item
            </Link>
          )
        }
      />
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Notice tone="good">Item deleted.</Notice>
        </div>
      )}
      {flagged.length > 0 && (
        <div className="mb-4">
          <Notice>
            {flagged.length} item(s) have review notes from the migration (unreadable prices, possible spelling errors). Nothing was changed automatically.{" "}
            <Link href={flaggedOnly ? "/admin/menu" : "/admin/menu?flagged=1"} className="font-medium underline">
              {flaggedOnly ? "Show all items" : "Show only flagged items"}
            </Link>
          </Notice>
        </div>
      )}

      <div className="space-y-5">
        {cats.map((c, ci) => {
          const list = items.filter((i) => i.categoryId === c.id && (!flaggedOnly || i.reviewNote));
          if (flaggedOnly && list.length === 0) return null;
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {c.name} {c.status === "draft" && <Badge tone="warn">Hidden</Badge>}
                  </h2>
                  {c.note && <p className="text-xs text-[#6b665e]">{c.note}</p>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <InlineAction action={moveCategoryAction} hidden={{ id: c.id, dir: "up" }} label={<ArrowUp size={14} />} title="Move category up" />
                    <InlineAction action={moveCategoryAction} hidden={{ id: c.id, dir: "down" }} label={<ArrowDown size={14} />} title="Move category down" />
                  </div>
                )}
              </div>

              <ul className="mt-3 divide-y divide-[#f0ede8]">
                {list.map((i, ii) => (
                  <li key={i.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/menu/items/${i.id}`} className="text-sm font-medium hover:underline">
                        {i.name}
                      </Link>
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {i.featured && <Badge tone="info">Featured</Badge>}
                        {!i.available && <Badge tone="warn">Unavailable</Badge>}
                        {i.status === "draft" && <Badge tone="warn">Draft</Badge>}
                        {i.reviewNote && (
                          <span title={i.reviewNote}>
                            <Badge tone="warn">
                              <Flag size={12} className="mr-1" /> Review
                            </Badge>
                          </span>
                        )}
                      </span>
                      {flaggedOnly && i.reviewNote && <p className="text-xs text-amber-800">{i.reviewNote}</p>}
                    </div>
                    <span className={`shrink-0 text-sm tabular-nums ${i.prices.some((p) => p.amountPence === null) ? "font-medium text-amber-800" : ""}`}>
                      {formatPrices(i.prices, i.sourcePriceText) || "No price"}
                    </span>
                    {canEdit && !flaggedOnly && (
                      <span className="flex shrink-0 gap-1">
                        <InlineAction action={moveItemAction} hidden={{ id: i.id, dir: "up" }} label={<ArrowUp size={12} />} title="Move up" className={`admin-btn admin-btn-secondary min-h-[28px] px-2 ${ii === 0 ? "invisible" : ""}`} />
                        <InlineAction action={moveItemAction} hidden={{ id: i.id, dir: "down" }} label={<ArrowDown size={12} />} title="Move down" className={`admin-btn admin-btn-secondary min-h-[28px] px-2 ${ii === list.length - 1 ? "invisible" : ""}`} />
                      </span>
                    )}
                  </li>
                ))}
                {list.length === 0 && <li className="py-3 text-sm text-[#6b665e]">No items in this category.</li>}
              </ul>

              {canEdit && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-[#6b665e]">Edit category</summary>
                  <div className="mt-3">
                    <ActionForm action={saveCategoryAction} compact submitLabel="Save category">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="grid gap-3 md:grid-cols-[1fr_2fr_160px]">
                        <TextInput name="name" label="Name" defaultValue={c.name} required />
                        <TextInput name="note" label="Note under the heading" defaultValue={c.note} />
                        <Select name="status" label="Visibility" defaultValue={c.status} options={[{ value: "published", label: "Shown" }, { value: "draft", label: "Hidden" }]} />
                      </div>
                    </ActionForm>
                    {canDelete && (
                      <div className="mt-3">
                        <ConfirmButton action={deleteCategoryAction} hidden={{ id: c.id }} label="Delete category" question="Delete this category? It must be empty." />
                      </div>
                    )}
                  </div>
                </details>
              )}
              <span className="sr-only">Category {ci + 1}</span>
            </Card>
          );
        })}

        {canEdit && !flaggedOnly && (
          <Card title="Add a category">
            <ActionForm action={saveCategoryAction} compact submitLabel="Add category" resetOnSuccess showCancel={false}>
              <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
                <TextInput name="name" label="Name" required />
                <TextInput name="note" label="Note under the heading" />
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
