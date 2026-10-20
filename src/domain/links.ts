import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, t } from "@/db";
import { getSetting, telHref } from "@/lib/settings";
import { getPublishedPage, TAGS } from "./content";

export type BookTarget = { href: string; external: boolean; kind: "url" | "form" | "phone" | "contact" };

const tableFormEnabled = unstable_cache(
  async () => {
    const row = await db.query.forms.findFirst({ where: eq(t.forms.key, "table_request"), columns: { enabled: true } });
    return Boolean(row?.enabled);
  },
  ["table-form-enabled"],
  { tags: [TAGS.pages, "forms"] },
);

/**
 * Where "Book Table" goes, in order of preference:
 *  1. The external booking system URL (Business settings) — booking is a separate project.
 *  2. The table-request form page (/book-table), if that form and page are enabled.
 *  3. The phone number.
 *  4. The contact page.
 */
export const getBookTarget = cache(async (): Promise<BookTarget> => {
  const business = await getSetting("business");
  if (business.bookTableUrl) return { href: business.bookTableUrl, external: true, kind: "url" };
  if ((await tableFormEnabled()) && (await getPublishedPage("book-table"))) return { href: "/book-table", external: false, kind: "form" };
  if (business.phone) return { href: telHref(business.phone), external: false, kind: "phone" };
  return { href: "/contact", external: false, kind: "contact" };
});

/** Resolve an editor-entered link. "book" becomes the Book Table target. */
export function resolveHref(href: string, book: BookTarget): { href: string; external: boolean } {
  if (href === "book") return { href: book.href, external: book.external };
  return { href, external: /^https:\/\//.test(href) };
}
