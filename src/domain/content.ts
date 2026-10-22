import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db, t } from "@/db";
import type { MenuPrice } from "@/db/schema";
import { parseSections, type Section } from "./sections";

export const TAGS = {
  pages: "pages",
  nav: "nav",
  menu: "menu",
  offers: "offers",
  media: "media",
  popups: "popups",
  redirects: "redirects",
} as const;

/** Invalidate public caches after an admin change. */
export function invalidate(...tags: (keyof typeof TAGS)[]) {
  for (const tag of tags) {
    try {
      revalidateTag(TAGS[tag], { expire: 0 });
    } catch {
      // Not inside a request (scripts): nothing cached to clear.
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Pages & navigation                                                         */
/* -------------------------------------------------------------------------- */

export type PublicPage = {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
  seoTitle: string;
  seoDescription: string;
  ogImageId: string | null;
  canonicalUrl: string;
  noindex: boolean;
  updatedAt: Date;
};

export const getPublishedPage = cache((slug: string) =>
  unstable_cache(
    async (): Promise<PublicPage | null> => {
      const row = await db.query.pages.findFirst({ where: and(eq(t.pages.slug, slug), eq(t.pages.status, "published")) });
      if (!row) return null;
      return { ...row, sections: parseSections(row.sections).sections.filter((s) => !s.hidden) };
    },
    ["page", slug],
    { tags: [TAGS.pages] },
  )(),
);

export const getPublishedSlugs = unstable_cache(
  async () =>
    db
      .select({ slug: t.pages.slug, updatedAt: t.pages.updatedAt, noindex: t.pages.noindex })
      .from(t.pages)
      .where(eq(t.pages.status, "published")),
  ["page-slugs"],
  { tags: [TAGS.pages] },
);

export type NavLink = { id: string; label: string; href: string };

export const getNav = cache((location: "header" | "footer") =>
  unstable_cache(
    async (): Promise<NavLink[]> =>
      db
        .select({ id: t.navItems.id, label: t.navItems.label, href: t.navItems.href })
        .from(t.navItems)
        .where(and(eq(t.navItems.location, location), eq(t.navItems.visible, true)))
        .orderBy(asc(t.navItems.sortOrder)),
    ["nav", location],
    { tags: [TAGS.nav] },
  )(),
);

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export type PublicMedia = {
  id: string;
  url: string;
  posterUrl: string | null;
  alt: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  caption: string;
};

/** Load media for rendering. Assets marked rights-excluded are never returned. */
export const getMediaByIds = cache(async (ids: string[]): Promise<Map<string, PublicMedia>> => {
  const unique = [...new Set(ids.filter(Boolean))].sort();
  if (unique.length === 0) return new Map();
  const rows = await unstable_cache(
    async () =>
      db
        .select({
          id: t.mediaAssets.id,
          url: t.mediaAssets.url,
          posterUrl: t.mediaAssets.posterUrl,
          alt: t.mediaAssets.alt,
          mimeType: t.mediaAssets.mimeType,
          width: t.mediaAssets.width,
          height: t.mediaAssets.height,
          caption: t.mediaAssets.caption,
        })
        .from(t.mediaAssets)
        .where(and(inArray(t.mediaAssets.id, unique), ne(t.mediaAssets.rightsStatus, "excluded"))),
    ["media", ...unique],
    { tags: [TAGS.media] },
  )();
  return new Map(rows.map((r) => [r.id, r]));
});

/** Every media id referenced by a list of sections (for one batched lookup). */
export function sectionMediaIds(sections: Section[]): string[] {
  const ids: string[] = [];
  for (const s of sections) {
    if ("mediaId" in s && s.mediaId) ids.push(s.mediaId);
    if ("videoId" in s && s.videoId) ids.push(s.videoId);
    if (s.type === "gallery") ids.push(...s.mediaIds);
    if (s.type === "journey") ids.push(...s.steps.flatMap((st) => st.mediaIds));
  }
  return ids;
}

/* -------------------------------------------------------------------------- */
/* Menu & offers                                                              */
/* -------------------------------------------------------------------------- */

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string;
  priceText: string;
  imageId: string | null;
  featured: boolean;
};
export type PublicMenuCategory = { id: string; name: string; note: string; items: PublicMenuItem[] };

/** "£10.99", "330ml £3.00 · 750ml £4.50"; falls back to the exact source text when a price couldn't be read. */
export function formatPrices(prices: MenuPrice[], sourcePriceText: string): string {
  if (prices.length === 0 || prices.some((p) => p.amountPence === null)) return sourcePriceText;
  return prices
    .map((p) => `${p.label ? `${p.label} ` : ""}£${(p.amountPence! / 100).toFixed(2)}`)
    .join(" · ");
}

export const getMenu = unstable_cache(
  async (): Promise<PublicMenuCategory[]> => {
    const cats = await db
      .select()
      .from(t.menuCategories)
      .where(eq(t.menuCategories.status, "published"))
      .orderBy(asc(t.menuCategories.sortOrder));
    const items = await db
      .select()
      .from(t.menuItems)
      .where(and(eq(t.menuItems.status, "published"), eq(t.menuItems.available, true)))
      .orderBy(asc(t.menuItems.sortOrder));
    return cats
      .map((c) => ({
        id: c.id,
        name: c.name,
        note: c.note,
        items: items
          .filter((i) => i.categoryId === c.id)
          .map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            priceText: formatPrices(i.prices, i.sourcePriceText),
            imageId: i.imageId,
            featured: i.featured,
          })),
      }))
      .filter((c) => c.items.length > 0);
  },
  ["menu"],
  { tags: [TAGS.menu] },
);

export const getOffers = unstable_cache(
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.select().from(t.offers).where(eq(t.offers.status, "published")).orderBy(asc(t.offers.sortOrder));
    return rows.filter((o) => (!o.startsOn || o.startsOn <= today) && (!o.endsOn || o.endsOn >= today));
  },
  ["offers"],
  { tags: [TAGS.offers], revalidate: 3600 },
);

/* -------------------------------------------------------------------------- */
/* Pop-ups                                                                    */
/* -------------------------------------------------------------------------- */

export const getEnabledPopups = unstable_cache(
  async () => db.select().from(t.popups).where(eq(t.popups.enabled, true)),
  ["popups"],
  { tags: [TAGS.popups], revalidate: 300 },
);

/* -------------------------------------------------------------------------- */
/* Redirects                                                                  */
/* -------------------------------------------------------------------------- */

export const getRedirects = unstable_cache(
  async () =>
    db
      .select({ id: t.redirects.id, fromPath: t.redirects.fromPath, toPath: t.redirects.toPath, statusCode: t.redirects.statusCode, prefix: t.redirects.prefix })
      .from(t.redirects)
      .where(eq(t.redirects.enabled, true)),
  ["redirects"],
  { tags: [TAGS.redirects] },
);

/** Normalise a request path for redirect matching: lowercase, single trailing slash removed. */
export function normalisePath(p: string): string {
  const path = p.split("?")[0].toLowerCase();
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function matchRedirect<R extends { fromPath: string; prefix: boolean }>(rules: R[], path: string): R | null {
  const p = normalisePath(path);
  let best: R | null = null;
  for (const r of rules) {
    const from = normalisePath(r.fromPath);
    if (from === p) return r;
    if (r.prefix && (p.startsWith(from + "/") || p === from) && (!best || from.length > normalisePath(best.fromPath).length)) best = r;
  }
  return best;
}
