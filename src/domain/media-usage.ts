import "server-only";
import { eq, or } from "drizzle-orm";
import { db, t } from "@/db";
import { getSettingFresh } from "@/lib/settings";
import { parseSections } from "./sections";

export type Usage = { kind: string; label: string; href: string };

/** Everywhere a media asset is referenced, so it isn't deleted while in use. */
export async function mediaUsage(id: string, url: string): Promise<Usage[]> {
  const out: Usage[] = [];
  const pages = await db.select({ id: t.pages.id, title: t.pages.title, sections: t.pages.sections, ogImageId: t.pages.ogImageId }).from(t.pages);
  for (const p of pages) {
    const { sections } = parseSections(p.sections);
    const used =
      p.ogImageId === id ||
      sections.some((s) => ("mediaId" in s && s.mediaId === id) || ("videoId" in s && s.videoId === id) || (s.type === "gallery" && s.mediaIds.includes(id)));
    if (used) out.push({ kind: "Page", label: p.title, href: `/admin/pages/${p.id}` });
  }
  const items = await db.select({ id: t.menuItems.id, name: t.menuItems.name }).from(t.menuItems).where(eq(t.menuItems.imageId, id));
  for (const i of items) out.push({ kind: "Menu item", label: i.name, href: `/admin/menu/items/${i.id}` });
  const offers = await db.select({ id: t.offers.id, title: t.offers.title }).from(t.offers).where(eq(t.offers.imageId, id));
  for (const o of offers) out.push({ kind: "Offer", label: o.title, href: `/admin/offers/${o.id}` });
  const popups = await db.select({ id: t.popups.id, name: t.popups.name }).from(t.popups).where(or(eq(t.popups.imageId, id)));
  for (const p of popups) out.push({ kind: "Pop-up", label: p.name, href: `/admin/popups/${p.id}` });
  const [brand, seo] = await Promise.all([getSettingFresh("brand"), getSettingFresh("seo")]);
  if (brand.logoUrl === url || brand.faviconUrl === url) out.push({ kind: "Brand", label: "Logo or icon", href: "/admin/business#brand" });
  if (seo.defaultOgImage === url) out.push({ kind: "SEO", label: "Default sharing image", href: "/admin/seo" });
  return out;
}
