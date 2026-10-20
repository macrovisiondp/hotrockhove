import type { MetadataRoute } from "next";
import { getPublishedSlugs } from "@/domain/content";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSetting("seo");
  if (!seo.allowIndexing) return [];
  const base = env().APP_URL;
  const rows = await getPublishedSlugs();
  return rows
    .filter((r) => !r.noindex)
    .map((r) => ({ url: r.slug ? `${base}/${r.slug}` : base, lastModified: r.updatedAt, priority: r.slug ? 0.7 : 1 }));
}
