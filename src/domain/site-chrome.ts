import "server-only";
import { unstable_cache } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { parseFields, type FormField } from "./forms/fields";
import { getEnabledPopups, getMediaByIds, getPublishedPage, TAGS } from "./content";
import { parseSections } from "./sections";
import type { BookTarget } from "./links";
import { resolveHref } from "./links";

/** Paths whose first section is a hero with an image/video, so the header can float over it. */
export const getOverlayPaths = unstable_cache(
  async () => {
    const rows = await db.select({ slug: t.pages.slug, sections: t.pages.sections }).from(t.pages).where(eq(t.pages.status, "published"));
    return rows
      .filter((r) => {
        const first = parseSections(r.sections).sections.find((s) => !s.hidden);
        return first?.type === "hero" && Boolean(first.mediaId || first.videoId);
      })
      .map((r) => (r.slug ? `/${r.slug}` : "/"));
  },
  ["overlay-paths"],
  { tags: [TAGS.pages] },
);

export async function getPrivacyHref(): Promise<string | null> {
  return (await getPublishedPage("privacy-policy")) ? "/privacy-policy" : null;
}

/** Pop-ups currently inside their schedule, shaped for the client. */
export async function getClientPopups(book: BookTarget) {
  const now = Date.now();
  const rows = (await getEnabledPopups()).filter(
    (p) => (!p.startsAt || new Date(p.startsAt).getTime() <= now) && (!p.endsAt || new Date(p.endsAt).getTime() > now),
  );
  const media = await getMediaByIds(rows.map((p) => p.imageId ?? "").filter(Boolean));
  const formKeys = [...new Set(rows.map((p) => p.formKey).filter((k) => k && k !== "newsletter"))];
  const forms: Record<string, { fields: FormField[]; submitLabel: string }> = {};
  if (formKeys.length) {
    const fr = await db.select().from(t.forms).where(inArray(t.forms.key, formKeys));
    for (const f of fr) if (f.enabled) forms[f.key] = { fields: parseFields(f.fields), submitLabel: f.submitLabel };
  }
  const popups = rows
    .filter((p) => !p.formKey || p.formKey === "newsletter" || forms[p.formKey])
    .map((p) => {
      const img = p.imageId ? media.get(p.imageId) : undefined;
      const cta = p.ctaLabel && p.ctaHref ? { label: p.ctaLabel, ...resolveHref(p.ctaHref, book) } : null;
      return {
        id: p.id,
        version: String(new Date(p.updatedAt).getTime()),
        template: (["image_top", "image_side", "text_only"].includes(p.template) ? p.template : "image_top") as "image_top" | "image_side" | "text_only",
        heading: p.heading,
        body: p.body,
        image: img && !img.mimeType.startsWith("video/") ? { url: img.url, alt: img.alt } : null,
        cta,
        formKey: p.formKey,
        pages: p.pages,
        trigger: p.trigger,
        delaySeconds: p.delaySeconds,
        scrollPercent: p.scrollPercent,
        frequency: p.frequency,
        frequencyDays: p.frequencyDays,
        priority: p.priority,
      };
    });
  return { popups, forms };
}
