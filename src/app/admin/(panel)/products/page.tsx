import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowDown, ArrowUp, Flag } from "@phosphor-icons/react/dist/ssr";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { InlineAction } from "@/components/admin/form";
import { Badge, EmptyState, Notice, PageHeader } from "@/components/admin/ui";
import { moveProductAction } from "./actions";

export const metadata = { title: "Products" };

export default async function ProductsAdmin({ searchParams }: PageProps<"/admin/products">) {
  const user = await requirePermission("content.view");
  const sp = await searchParams;
  const canEdit = can(user.role, "menu.edit");
  const rows = await db.select().from(t.products).orderBy(asc(t.products.sortOrder));

  return (
    <>
      <PageHeader
        title="Products"
        description="HotRock merchandise shown on the site (display only for now; no online checkout yet)."
        actions={
          canEdit && (
            <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
              Add product
            </Link>
          )
        }
      />
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Notice tone="good">Product deleted.</Notice>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No products yet" />
      ) : (
        <ul className="space-y-3">
          {rows.map((p, i) => (
            <li key={p.id} className="admin-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>{" "}
                <span className="inline-flex flex-wrap gap-1 align-middle">
                  {p.status === "draft" ? <Badge>Draft</Badge> : <Badge tone="good">Live</Badge>}
                  {!p.available && <Badge tone="warn">Unavailable</Badge>}
                  {p.reviewNote && (
                    <span title={p.reviewNote}>
                      <Badge tone="warn">
                        <Flag size={12} className="mr-1" /> Review
                      </Badge>
                    </span>
                  )}
                </span>
                <p className="text-xs text-[#6b665e]">
                  {[p.priceText || "No price shown", p.sku && `SKU ${p.sku}`, `${p.imageIds.length} photo${p.imageIds.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canEdit && (
                <span className="flex shrink-0 gap-1">
                  <InlineAction action={moveProductAction} hidden={{ id: p.id, dir: "up" }} label={<ArrowUp size={12} />} title="Move up" className={`admin-btn admin-btn-secondary min-h-[28px] px-2 ${i === 0 ? "invisible" : ""}`} />
                  <InlineAction action={moveProductAction} hidden={{ id: p.id, dir: "down" }} label={<ArrowDown size={12} />} title="Move down" className={`admin-btn admin-btn-secondary min-h-[28px] px-2 ${i === rows.length - 1 ? "invisible" : ""}`} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
