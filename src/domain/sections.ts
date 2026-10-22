import { z } from "zod";

/**
 * Page content is an ordered list of typed sections. Editors fill in structured
 * fields; nothing is stored or rendered as raw HTML. Body text supports a small,
 * safe subset of formatting (paragraphs, line breaks, **bold**, *italic*) handled
 * by src/components/site/rich-text.tsx, which escapes everything else.
 */

const text = (max: number) => z.string().trim().max(max);
const mediaId = z.union([z.literal(""), z.string().uuid()]);

/** Internal path, https URL, tel:/mailto:, or the keywords "book" (Book Table) / "menu". */
export const linkHref = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || v === "book" || /^\/(?!\/)[^\s]*$/.test(v) || /^https:\/\/[^\s]+$/.test(v) || /^(tel|mailto):[^\s]+$/.test(v) || /^#[A-Za-z][\w-]*$/.test(v),
    "Use a path like /our-menus, an https:// link, tel:, mailto:, or 'book'",
  );

const cta = z.object({ label: text(40), href: linkHref });

const base = { id: z.string().min(1).max(40), hidden: z.boolean().default(false) };

export const sectionSchemas = {
  hero: z.object({
    ...base,
    type: z.literal("hero"),
    eyebrow: text(80),
    heading: text(140),
    body: text(400),
    mediaId,
    /** Optional looping background video (muted, no audio). Image is the poster/fallback. */
    videoId: mediaId,
    /** "cover" fills the banner; "float" shows the image as a gently floating cut-out beside the text (e.g. Daisy's balloon). */
    mediaStyle: z.enum(["cover", "float"]).default("cover"),
    primaryCta: cta,
    secondaryCta: cta,
  }),
  story: z.object({
    ...base,
    type: z.literal("story"),
    eyebrow: text(80),
    heading: text(140),
    body: text(6000),
    signature: text(80),
    signatureRole: text(120),
    mediaId,
    imageSide: z.enum(["left", "right"]),
    cta,
  }),
  text: z.object({
    ...base,
    type: z.literal("text"),
    eyebrow: text(80),
    heading: text(140),
    body: text(20000),
    align: z.enum(["left", "center"]),
  }),
  quote: z.object({
    ...base,
    type: z.literal("quote"),
    quote: text(300),
    attribution: text(120),
  }),
  video: z.object({
    ...base,
    type: z.literal("video"),
    eyebrow: text(80),
    heading: text(140),
    body: text(1000),
    videoId: mediaId,
    /** Poster image shown before playback (Cloudinary generates one automatically when empty). */
    mediaId: mediaId.default(""),
  }),
  menuHighlights: z.object({
    ...base,
    type: z.literal("menuHighlights"),
    eyebrow: text(80),
    heading: text(140),
    body: text(400),
    cta,
  }),
  menu: z.object({
    ...base,
    type: z.literal("menu"),
    eyebrow: text(80),
    heading: text(140),
    body: text(1000),
  }),
  offers: z.object({
    ...base,
    type: z.literal("offers"),
    eyebrow: text(80),
    heading: text(140),
    body: text(1000),
  }),
  gallery: z.object({
    ...base,
    type: z.literal("gallery"),
    eyebrow: text(80),
    heading: text(140),
    mediaIds: z.array(z.string().uuid()).max(200),
    /** 0 = show all; otherwise a preview of N items with the CTA below. */
    limit: z.number().int().min(0).max(200),
    cta,
  }),
  reviews: z.object({
    ...base,
    type: z.literal("reviews"),
    eyebrow: text(80),
    heading: text(140),
  }),
  visit: z.object({
    ...base,
    type: z.literal("visit"),
    eyebrow: text(80),
    heading: text(140),
    body: text(400),
    mediaId,
    /** Show a Google map of the business address instead of the image (loads after cookie consent or a click). */
    showMap: z.boolean().default(false),
  }),
  tour: z.object({
    ...base,
    type: z.literal("tour"),
    eyebrow: text(80),
    heading: text(140),
    body: text(400),
  }),
  cta: z.object({
    ...base,
    type: z.literal("cta"),
    heading: text(140),
    body: text(400),
    mediaId,
    primaryCta: cta,
    secondaryCta: cta,
  }),
  form: z.object({
    ...base,
    type: z.literal("form"),
    eyebrow: text(80),
    heading: text(140),
    body: text(1000),
    formKey: z.string().min(1).max(40),
    /** Show contact details and hours beside the form. */
    showContact: z.boolean(),
  }),
  newsletter: z.object({
    ...base,
    type: z.literal("newsletter"),
    heading: text(140),
    body: text(400),
  }),
} as const;

export type SectionType = keyof typeof sectionSchemas;
export const SECTION_TYPES = Object.keys(sectionSchemas) as SectionType[];

export const sectionSchema = z.discriminatedUnion("type", [
  sectionSchemas.hero,
  sectionSchemas.story,
  sectionSchemas.text,
  sectionSchemas.quote,
  sectionSchemas.video,
  sectionSchemas.menuHighlights,
  sectionSchemas.menu,
  sectionSchemas.offers,
  sectionSchemas.gallery,
  sectionSchemas.reviews,
  sectionSchemas.visit,
  sectionSchemas.tour,
  sectionSchemas.cta,
  sectionSchemas.form,
  sectionSchemas.newsletter,
]);

export type Section = z.infer<typeof sectionSchema>;
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;
export type Cta = z.infer<typeof cta>;

export const sectionsSchema = z.array(sectionSchema).max(40);

/** Parse stored sections, dropping (and reporting) any that no longer validate. */
export function parseSections(raw: unknown): { sections: Section[]; invalid: number } {
  if (!Array.isArray(raw)) return { sections: [], invalid: 0 };
  const sections: Section[] = [];
  let invalid = 0;
  for (const s of raw) {
    const r = sectionSchema.safeParse(s);
    if (r.success) sections.push(r.data);
    else invalid++;
  }
  return { sections, invalid };
}

const emptyCta = { label: "", href: "" };

/** A blank section of each type, used by "Add section" in the page editor. */
export function blankSection(type: SectionType, id: string): Section {
  const common = { id, hidden: false };
  switch (type) {
    case "hero":
      return { ...common, type, eyebrow: "", heading: "", body: "", mediaId: "", videoId: "", mediaStyle: "cover", primaryCta: emptyCta, secondaryCta: emptyCta };
    case "story":
      return { ...common, type, eyebrow: "", heading: "", body: "", signature: "", signatureRole: "", mediaId: "", imageSide: "left", cta: emptyCta };
    case "text":
      return { ...common, type, eyebrow: "", heading: "", body: "", align: "left" };
    case "quote":
      return { ...common, type, quote: "", attribution: "" };
    case "video":
      return { ...common, type, eyebrow: "", heading: "", body: "", videoId: "", mediaId: "" };
    case "menuHighlights":
      return { ...common, type, eyebrow: "", heading: "", body: "", cta: emptyCta };
    case "menu":
      return { ...common, type, eyebrow: "", heading: "", body: "" };
    case "offers":
      return { ...common, type, eyebrow: "", heading: "", body: "" };
    case "gallery":
      return { ...common, type, eyebrow: "", heading: "", mediaIds: [], limit: 0, cta: emptyCta };
    case "reviews":
      return { ...common, type, eyebrow: "", heading: "" };
    case "visit":
      return { ...common, type, eyebrow: "", heading: "", body: "", mediaId: "", showMap: false };
    case "tour":
      return { ...common, type, eyebrow: "", heading: "", body: "" };
    case "cta":
      return { ...common, type, heading: "", body: "", mediaId: "", primaryCta: emptyCta, secondaryCta: emptyCta };
    case "form":
      return { ...common, type, eyebrow: "", heading: "", body: "", formKey: "contact", showContact: true };
    case "newsletter":
      return { ...common, type, heading: "", body: "" };
  }
}

export const SECTION_LABELS: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: "Hero", hint: "Large opening banner with image or video and buttons" },
  story: { label: "Story", hint: "Text beside an image, with optional signature" },
  text: { label: "Text", hint: "Heading and paragraphs" },
  quote: { label: "Quote", hint: "A highlighted line, e.g. the house motto" },
  video: { label: "Video", hint: "A featured video with caption" },
  menuHighlights: { label: "Menu highlights", hint: "Shows menu items marked as featured" },
  menu: { label: "Full menu", hint: "Every published category and item, with prices" },
  offers: { label: "Offers", hint: "Lists the offers from the Offers module" },
  gallery: { label: "Gallery", hint: "Grid of selected photos and videos" },
  reviews: { label: "Reviews", hint: "Google reviews widget (after cookie consent)" },
  visit: { label: "Visit us", hint: "Address, hours and contact from Business settings, with an image or map" },
  tour: { label: "3D tour", hint: "The 360° venue tour set in Site settings (loads on click or after cookie consent)" },
  cta: { label: "Call to action", hint: "Banner with buttons" },
  form: { label: "Form", hint: "Contact, fan club or table request form" },
  newsletter: { label: "Newsletter", hint: "Email sign-up with consent and double opt-in" },
};
