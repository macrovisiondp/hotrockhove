import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { env, turnstileConfigured } from "@/lib/env";
import { formatAddress, getSetting, type BusinessSettings } from "@/lib/settings";
import { PageTitle, RenderSections, type SectionContext } from "@/components/site/sections";
import { getMediaByIds, getMenu, getOffers, getPublishedPage, sectionMediaIds } from "./content";
import { parseFields } from "./forms/fields";
import { getBookTarget } from "./links";
import { getPrivacyHref } from "./site-chrome";

const SELF_TITLED = new Set(["hero", "menu", "gallery", "form"]);

export async function pageMetadata(slug: string): Promise<Metadata> {
  const [page, seo] = await Promise.all([getPublishedPage(slug), getSetting("seo")]);
  if (!page) return {};
  const ogIds = [page.ogImageId ?? ""].filter(Boolean);
  const media = await getMediaByIds(ogIds);
  const og = page.ogImageId ? media.get(page.ogImageId)?.url : seo.defaultOgImage || undefined;
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || seo.defaultDescription || undefined;
  const path = slug ? `/${slug}` : "/";
  return {
    title: slug ? title : { absolute: page.seoTitle || seo.siteTitle },
    description,
    alternates: { canonical: page.canonicalUrl || path },
    openGraph: { title, description, url: path, siteName: seo.siteTitle, type: "website", locale: "en_GB", images: og ? [{ url: og }] : undefined },
    twitter: { card: og ? "summary_large_image" : "summary", title, description },
    robots: !seo.allowIndexing || page.noindex ? { index: false, follow: !page.noindex } : undefined,
  };
}

/** Restaurant structured data, built only from configured (non-empty) business settings. */
function restaurantJsonLd(b: BusinessSettings, hasMenu: boolean) {
  const url = env().APP_URL;
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": "Restaurant", name: b.name, url, servesCuisine: "Steakhouse" };
  if (b.phone) data.telephone = b.phone;
  if (b.email) data.email = b.email;
  if (formatAddress(b))
    data.address = {
      "@type": "PostalAddress",
      streetAddress: [b.addressLine1, b.addressLine2].filter(Boolean).join(", "),
      addressLocality: b.town || undefined,
      postalCode: b.postcode || undefined,
      addressCountry: "GB",
    };
  if (b.hours.length) {
    const names = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" } as const;
    data.openingHoursSpecification = b.hours
      .filter((h) => !h.closed)
      .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: names[h.day], opens: h.opens, closes: h.closes }));
  }
  if (hasMenu) data.hasMenu = `${url}/our-menus`;
  if (b.bookTableUrl) data.acceptsReservations = true;
  const sameAs = [b.facebookUrl, b.instagramUrl, b.tiktokUrl].filter(Boolean);
  if (sameAs.length) data.sameAs = sameAs;
  // Escape "<" so the JSON can't close the script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function RenderPage({ slug }: { slug: string }) {
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  const types = new Set(page.sections.map((s) => s.type));
  const formKeys = page.sections.flatMap((s) => (s.type === "form" ? [s.formKey] : []));
  const needsMenu = types.has("menu") || types.has("menuHighlights");

  const [business, features, book, privacyHref, menu, offers, formRows] = await Promise.all([
    getSetting("business"),
    getSetting("features"),
    getBookTarget(),
    getPrivacyHref(),
    needsMenu ? getMenu() : Promise.resolve([]),
    types.has("offers") ? getOffers() : Promise.resolve([]),
    formKeys.length ? db.select().from(t.forms).where(inArray(t.forms.key, formKeys)) : Promise.resolve([]),
  ]);

  const mediaIds = [...sectionMediaIds(page.sections), ...menu.flatMap((c) => c.items.map((i) => i.imageId ?? ""))];
  const media = await getMediaByIds(mediaIds);

  const ctx: SectionContext = {
    media,
    book,
    business,
    features,
    privacyHref,
    turnstileSiteKey: turnstileConfigured() ? env().NEXT_PUBLIC_TURNSTILE_SITE_KEY! : null,
    menu,
    offers,
    forms: Object.fromEntries(
      formRows.filter((f) => f.enabled).map((f) => [f.key, { name: f.name, fields: parseFields(f.fields), submitLabel: f.submitLabel }]),
    ),
  };

  const first = page.sections[0];
  const needsTitle = !first || !SELF_TITLED.has(first.type);

  return (
    <>
      {slug === "" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: restaurantJsonLd(business, Boolean(await getPublishedPage("our-menus"))) }}
        />
      )}
      {needsTitle && <PageTitle title={page.title} />}
      <RenderSections sections={page.sections} ctx={ctx} />
    </>
  );
}
