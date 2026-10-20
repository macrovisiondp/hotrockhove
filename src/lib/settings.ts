import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { decryptSecret, encryptSecret, isEncrypted } from "./crypto";

/* -------------------------------------------------------------------------- */
/* Field helpers                                                              */
/* -------------------------------------------------------------------------- */

const blank = z.literal("");
const optionalEmail = z.union([blank, z.string().trim().toLowerCase().email("Enter a valid email address")]);
const optionalHttps = z.union([blank, z.string().trim().url("Enter a full URL").startsWith("https://", "Use an https:// URL")]);
/** UK-style phone: digits, spaces, +, brackets, hyphens. Displayed exactly as entered. */
const optionalPhone = z.union([blank, z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")]);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");
/** A project asset (/brand/…) or an https:// URL such as a Cloudinary image. */
export const assetRef = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/(brand|media)\/[A-Za-z0-9._/%-]+|https:\/\/\S+)$/, "Use /brand/…, /media/… or an https:// URL");

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/* -------------------------------------------------------------------------- */
/* Schemas                                                                    */
/* -------------------------------------------------------------------------- */

const hoursSchema = z
  .array(
    z
      .object({ day: z.enum(DAYS), closed: z.boolean(), opens: time, closes: time })
      .refine((h) => h.closed || h.opens !== h.closes, { message: "Opening and closing times are the same" }),
  )
  .length(7);

export const businessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(80),
  tagline: z.string().trim().max(160),
  phone: optionalPhone,
  email: optionalEmail,
  addressLine1: z.string().trim().max(120),
  addressLine2: z.string().trim().max(120),
  town: z.string().trim().max(80),
  postcode: z.string().trim().max(12),
  country: z.string().trim().max(60),
  mapUrl: optionalHttps,
  /** Empty array = hours not configured; the site then hides the hours block. */
  hours: z.union([z.array(z.never()).length(0), hoursSchema]),
  hoursNote: z.string().trim().max(200),
  /** External booking system (separate project). Empty = use the table-request form or phone. */
  bookTableUrl: optionalHttps,
  facebookUrl: optionalHttps,
  instagramUrl: optionalHttps,
  tiktokUrl: optionalHttps,
  footerBlurb: z.string().trim().max(300),
  /** Set by an admin once the values have been checked against reality. Drives launch readiness. */
  confirmed: z.object({ contact: z.boolean(), hours: z.boolean(), socials: z.boolean() }),
});

export const brandSchema = z.object({
  logoUrl: assetRef,
  faviconUrl: assetRef,
  /** Accent used for buttons, rules and highlights. */
  accentColour: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #ba9774"),
});

export const notificationsSchema = z.object({
  /** Staff inboxes for form notifications. Empty = notifications are not sent (dashboard warns). */
  recipients: z.array(z.string().trim().toLowerCase().email()).max(10),
});

export const emailSchema = z.object({
  provider: z.enum(["resend", "smtp", "none"]),
  fromName: z.string().trim().max(80),
  fromAddress: optionalEmail,
  replyTo: optionalEmail,
  /** Stored encrypted. Never sent to the browser. */
  resendApiKey: z.string(),
  smtp: z.object({
    host: z.string().trim().max(200),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().trim().max(200),
    password: z.string(), // encrypted at rest
  }),
  /** Master switch: no customer or staff email is sent until an admin enables delivery. */
  deliveryEnabled: z.boolean(),
  /** Set after a successful test send from the admin. */
  lastTestAt: z.string().nullable(),
  lastTestOk: z.boolean().nullable(),
});

export const seoSchema = z.object({
  siteTitle: z.string().trim().min(1).max(70),
  titleTemplate: z.string().trim().max(80).refine((v) => v.includes("%s"), "Must contain %s"),
  defaultDescription: z.string().trim().max(200),
  defaultOgImage: z.union([blank, assetRef]),
  /** Off until launch: every page sends noindex and robots.txt disallows crawling. */
  allowIndexing: z.boolean(),
});

export const consentSchema = z.object({
  bannerText: z.string().trim().min(10).max(400),
  analyticsProvider: z.enum(["none", "ga4", "plausible"]),
  analyticsId: z.string().trim().max(60),
});

export const featuresSchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().max(300),
  announcementEnabled: z.boolean(),
  announcementText: z.string().trim().max(160),
  announcementHref: z.string().trim().max(300),
  /** Trustindex Google-reviews embed. Loads only after cookie consent. */
  reviewsEnabled: z.boolean(),
  reviewsEmbedSrc: z.union([blank, z.string().trim().url().startsWith("https://cdn.trustindex.io/")]),
  /** 360° tour — disabled until ownership and licensing are confirmed (audit C8). */
  vrTourEnabled: z.boolean(),
  vrTourUrl: optionalHttps,
});

export const storageSchema = z.object({
  provider: z.enum(["cloudinary", "local"]),
  cloudinary: z.object({
    cloudName: z.string().trim().max(100),
    apiKey: z.string().trim().max(100),
    apiSecret: z.string(), // encrypted at rest
    folder: z.string().trim().max(100),
  }),
});

const SCHEMAS = {
  business: businessSchema,
  brand: brandSchema,
  notifications: notificationsSchema,
  email: emailSchema,
  seo: seoSchema,
  consent: consentSchema,
  features: featuresSchema,
  storage: storageSchema,
};

export type BusinessSettings = z.infer<typeof businessSchema>;
export type BrandSettings = z.infer<typeof brandSchema>;
export type NotificationSettings = z.infer<typeof notificationsSchema>;
export type EmailSettings = z.infer<typeof emailSchema>;
export type SeoSettings = z.infer<typeof seoSchema>;
export type ConsentSettings = z.infer<typeof consentSchema>;
export type FeatureSettings = z.infer<typeof featuresSchema>;
export type StorageSettings = z.infer<typeof storageSchema>;
export type OpeningHours = BusinessSettings["hours"];

type SettingsMap = {
  business: BusinessSettings;
  brand: BrandSettings;
  notifications: NotificationSettings;
  email: EmailSettings;
  seo: SeoSettings;
  consent: ConsentSettings;
  features: FeatureSettings;
  storage: StorageSettings;
};
export type SettingsKey = keyof SettingsMap;

/**
 * Defaults are deliberately neutral: no contact details, hours or links are
 * invented. Real values are imported by the seed script (flagged unconfirmed)
 * or entered in Admin → Business settings.
 */
export const DEFAULTS: SettingsMap = {
  business: {
    name: "Hot Rock Hove",
    tagline: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    country: "United Kingdom",
    mapUrl: "",
    hours: [],
    hoursNote: "",
    bookTableUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
    footerBlurb: "",
    confirmed: { contact: false, hours: false, socials: false },
  },
  brand: { logoUrl: "/brand/logo-white.png", faviconUrl: "/brand/icon-192.png", accentColour: "#ba9774" },
  notifications: { recipients: [] },
  email: {
    provider: "resend",
    fromName: "Hot Rock Hove",
    fromAddress: "",
    replyTo: "",
    resendApiKey: "",
    smtp: { host: "", port: 587, secure: false, user: "", password: "" },
    deliveryEnabled: false,
    lastTestAt: null,
    lastTestOk: null,
  },
  seo: {
    siteTitle: "Hot Rock Hove",
    titleTemplate: "%s | Hot Rock Hove",
    defaultDescription: "",
    defaultOgImage: "",
    allowIndexing: false,
  },
  consent: {
    bannerText:
      "We use essential cookies to run this site. With your permission we'd also load optional third-party content such as reviews and maps, and measure visits.",
    analyticsProvider: "none",
    analyticsId: "",
  },
  features: {
    maintenanceMode: false,
    maintenanceMessage: "We're making some improvements. Please check back shortly.",
    announcementEnabled: false,
    announcementText: "",
    announcementHref: "",
    reviewsEnabled: false,
    reviewsEmbedSrc: "",
    vrTourEnabled: false,
    vrTourUrl: "",
  },
  storage: {
    provider: "cloudinary",
    cloudinary: { cloudName: "", apiKey: "", apiSecret: "", folder: "hotrockhove" },
  },
};

/* -------------------------------------------------------------------------- */
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

export const settingsTag = (key: SettingsKey) => `settings:${key}`;

async function readRaw<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1);
  const stored = (row?.value as Record<string, unknown> | undefined) ?? {};
  const merged = { ...DEFAULTS[key], ...stored };
  const parsed = SCHEMAS[key].safeParse(merged);
  if (!parsed.success) {
    console.error(`[settings] stored "${key}" is invalid; using defaults`);
    return DEFAULTS[key];
  }
  return parsed.data as SettingsMap[K];
}

/**
 * Cross-request cached read, invalidated on save. Secrets stay encrypted in the
 * returned value — callers must use revealSecret() server-side and never pass
 * email/storage settings to client components.
 */
export const getSetting = cache(<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> =>
  unstable_cache(() => readRaw(key), ["settings", key], { tags: [settingsTag(key), "settings"] })(),
);

/** Uncached read for admin forms and for scripts outside the Next.js runtime. */
export const getSettingFresh = readRaw;

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsMap[K], userId?: string) {
  const data = SCHEMAS[key].parse(value);
  await db
    .insert(t.settings)
    .values({ key, value: data, updatedById: userId ?? null })
    .onConflictDoUpdate({ target: t.settings.key, set: { value: data, updatedById: userId ?? null } });
  try {
    revalidateTag(settingsTag(key), { expire: 0 });
  } catch {
    // Outside a request (seed scripts) there is no cache to invalidate.
  }
}

export function validateSetting<K extends SettingsKey>(key: K, value: unknown): z.ZodSafeParseResult<SettingsMap[K]> {
  return SCHEMAS[key].safeParse(value) as z.ZodSafeParseResult<SettingsMap[K]>;
}

/* -------------------------------------------------------------------------- */
/* Secrets                                                                    */
/* -------------------------------------------------------------------------- */

export function revealSecret(value: string): string {
  if (!value) return "";
  return isEncrypted(value) ? decryptSecret(value) : value;
}

/** Empty input keeps the stored secret; anything else replaces it (encrypted). */
export function mergeSecret(current: string, input: string | undefined | null): string {
  if (!input) return current;
  return encryptSecret(input);
}

/** Last four characters for display ("••••abcd"), or null when unset. */
export function maskSecret(value: string): string | null {
  if (!value) return null;
  try {
    const plain = revealSecret(value);
    return plain.length > 8 ? `••••${plain.slice(-4)}` : "••••";
  } catch {
    return "•••• (unreadable — re-enter)";
  }
}

/* -------------------------------------------------------------------------- */
/* Derived helpers                                                            */
/* -------------------------------------------------------------------------- */

export function formatAddress(b: BusinessSettings): string {
  return [b.addressLine1, b.addressLine2, b.town, b.postcode].filter(Boolean).join(", ");
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

/** Display "16:30" as "4:30pm". */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/** Group consecutive days with identical hours: "Monday – Friday: 4:30pm – 10pm". */
export function groupHours(hours: OpeningHours): { label: string; value: string }[] {
  const out: { label: string; value: string; days: Day[] }[] = [];
  for (const h of hours) {
    const value = h.closed ? "Closed" : `${formatTime(h.opens)} - ${formatTime(h.closes)}`;
    const last = out.at(-1);
    if (last && last.value === value) last.days.push(h.day);
    else out.push({ label: "", value, days: [h.day] });
  }
  return out.map((g) => ({
    label: g.days.length === 1 ? DAY_LABELS[g.days[0]] : `${DAY_LABELS[g.days[0]]} to ${DAY_LABELS[g.days.at(-1)!]}`,
    value: g.value,
  }));
}

/** Replace {{placeholders}} in configurable templates. Unknown keys are left blank. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}
