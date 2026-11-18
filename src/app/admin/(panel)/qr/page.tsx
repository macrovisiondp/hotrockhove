import { and, asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { anchorFor, type QrTarget } from "@/domain/qr";
import { resolveAppUrl } from "@/lib/env";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/admin/ui";
import { QrGenerator } from "@/components/admin/qr-generator";

export const metadata = { title: "QR codes" };

type SectionLike = { type?: string; hidden?: boolean };

/** The published page that shows a section of this type (e.g. the menu), if any. */
function pageWith(pages: { slug: string; sections: unknown }[], type: string) {
  const p = pages.find((page) =>
    Array.isArray(page.sections) && (page.sections as SectionLike[]).some((s) => s?.type === type && !s.hidden),
  );
  return p ? `/${p.slug}` : null;
}

export default async function QrCodes() {
  await requirePermission("content.view");
  const today = new Date().toISOString().slice(0, 10);
  const [pages, categories, offers, products] = await Promise.all([
    db
      .select({ title: t.pages.title, slug: t.pages.slug, sections: t.pages.sections })
      .from(t.pages)
      .where(eq(t.pages.status, "published"))
      .orderBy(asc(t.pages.title)),
    db
      .select({ id: t.menuCategories.id, name: t.menuCategories.name })
      .from(t.menuCategories)
      .where(eq(t.menuCategories.status, "published"))
      .orderBy(asc(t.menuCategories.sortOrder)),
    db.select().from(t.offers).where(eq(t.offers.status, "published")).orderBy(asc(t.offers.sortOrder)),
    db
      .select({ name: t.products.name, slug: t.products.slug })
      .from(t.products)
      .where(eq(t.products.status, "published"))
      .orderBy(asc(t.products.sortOrder)),
  ]);
  const items = categories.length
    ? await db
        .select({ id: t.menuItems.id, name: t.menuItems.name, categoryId: t.menuItems.categoryId })
        .from(t.menuItems)
        .where(
          and(
            eq(t.menuItems.status, "published"),
            eq(t.menuItems.available, true),
            inArray(
              t.menuItems.categoryId,
              categories.map((c) => c.id),
            ),
          ),
        )
        .orderBy(asc(t.menuItems.sortOrder))
    : [];

  const menuPath = pageWith(pages, "menu");
  const offersPath = pageWith(pages, "offers");
  const productsPath = pageWith(pages, "products");
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const targets: QrTarget[] = [
    ...pages.map((p) => ({ kind: "page" as const, label: p.title || "Home", path: `/${p.slug}` })),
    ...(menuPath
      ? categories.flatMap((c) =>
          items
            .filter((i) => i.categoryId === c.id)
            .map((i) => ({
              kind: "menuItem" as const,
              label: `${i.name} (${categoryName.get(c.id)})`,
              path: menuPath,
              anchor: anchorFor.menuItem(i.id),
            })),
        )
      : []),
    ...(offersPath
      ? offers
          .filter((o) => !o.endsOn || o.endsOn >= today)
          .map((o) => ({
            kind: "offer" as const,
            label: o.startsOn && o.startsOn > today ? `${o.title} (from ${o.startsOn})` : o.title,
            path: offersPath,
            anchor: anchorFor.offer(o.id),
          }))
      : []),
    ...(productsPath
      ? products.map((p) => ({ kind: "product" as const, label: p.name, path: productsPath, anchor: anchorFor.product(p.slug) }))
      : []),
  ];

  return (
    <>
      <PageHeader
        title="QR codes"
        description="Make a QR code for any published page, menu item, offer or product, for table cards, posters and flyers. Scanning it opens that page on the website, scrolled to the item."
      />
      <QrGenerator targets={targets} defaultBase={resolveAppUrl()} />
    </>
  );
}
