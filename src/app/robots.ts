import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";

/** Crawling stays blocked until an admin enables indexing at launch (SEO settings). Previews never index. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection(); // reflects the indexing switch immediately
  const seo = await getSetting("seo");
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (!seo.allowIndexing || isPreview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/newsletter/", "/go/"] },
    sitemap: `${env().APP_URL}/sitemap.xml`,
  };
}
