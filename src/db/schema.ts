import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/** owner > admin > editor > viewer. See src/lib/rbac.ts for the permission matrix. */
export const userRole = pgEnum("user_role", ["owner", "admin", "editor", "viewer"]);
export const publishStatus = pgEnum("publish_status", ["draft", "published"]);
export const navLocation = pgEnum("nav_location", ["header", "footer"]);
export const storageProvider = pgEnum("storage_provider", ["cloudinary", "local", "s3", "neon"]);
export const altStatus = pgEnum("alt_status", ["ok", "missing", "needs_review"]);
export const rightsStatus = pgEnum("rights_status", ["cleared", "unconfirmed", "excluded"]);
export const submissionStatus = pgEnum("submission_status", ["new", "read", "archived", "spam"]);
export const subscriberStatus = pgEnum("subscriber_status", [
  "pending",
  "subscribed",
  "unsubscribed",
  /** Imported from WordPress without a recorded consent statement. Never mailed without a re-permission decision. */
  "legacy_unconfirmed",
]);
export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed", "skipped"]);
export const popupTrigger = pgEnum("popup_trigger", ["delay", "scroll", "exit_intent"]);
export const popupFrequency = pgEnum("popup_frequency", ["session", "days", "once"]);

export type UserRole = (typeof userRole.enumValues)[number];
export type PublishStatus = (typeof publishStatus.enumValues)[number];
export type StorageProviderName = (typeof storageProvider.enumValues)[number];
export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];
export type SubscriberStatus = (typeof subscriberStatus.enumValues)[number];

/* -------------------------------------------------------------------------- */
/* Users & authentication (Better Auth tables)                                */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("viewer"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Settings (business info, brand, email, SEO, consent, feature flags…)       */
/* -------------------------------------------------------------------------- */

/** One row per settings group. Values are validated by the Zod schemas in src/lib/settings.ts. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: storageProvider("provider").notNull(),
    storageKey: text("storage_key").notNull(),
    /** Public delivery URL (S3/CDN URL, Cloudinary secure URL, or /media/<key> for local development). */
    url: text("url").notNull(),
    /** Poster image for videos (Cloudinary generates one; for S3 an admin picks an image). */
    posterUrl: text("poster_url"),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    alt: text("alt").notNull().default(""),
    altStatus: altStatus("alt_status").notNull().default("missing"),
    caption: text("caption").notNull().default(""),
    /** Where the file came from (WordPress URL for migrated assets). */
    sourceUrl: text("source_url"),
    rightsStatus: rightsStatus("rights_status").notNull().default("cleared"),
    rightsNote: text("rights_note").notNull().default(""),
    uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("media_sha256_idx").on(t.sha256), index("media_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Pages & navigation                                                         */
/* -------------------------------------------------------------------------- */

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "" is the homepage. Otherwise a single path segment such as "wagyu". */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    status: publishStatus("status").notNull().default("draft"),
    /** Ordered, typed content blocks. Validated by src/domain/sections.ts. */
    sections: jsonb("sections").$type<unknown[]>().notNull().default([]),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    ogImageId: uuid("og_image_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    canonicalUrl: text("canonical_url").notNull().default(""),
    noindex: boolean("noindex").notNull().default(false),
    /** System pages (home, menu, contact…) cannot be deleted or re-slugged. */
    system: boolean("system").notNull().default(false),
    /** Review notes shown in the admin, e.g. "Theme demo copy — needs owner approval". */
    reviewNote: text("review_note").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("pages_slug_idx").on(t.slug)],
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_revisions_page_idx").on(t.pageId, t.createdAt)],
);

export const navItems = pgTable(
  "nav_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    location: navLocation("location").notNull(),
    label: text("label").notNull(),
    /** Internal path ("/wagyu") or https:// URL. The special value "book" uses the Book Table setting. */
    href: text("href").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("nav_items_location_idx").on(t.location, t.sortOrder)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull(),
    /** Internal path, https:// URL, or "book" (Book Table setting). Ignored for 410. */
    toPath: text("to_path").notNull().default(""),
    statusCode: integer("status_code").notNull().default(301),
    enabled: boolean("enabled").notNull().default(true),
    /** Matches the path and everything below it, e.g. /service/ covers /service/wedding/. */
    prefix: boolean("prefix").notNull().default(false),
    note: text("note").notNull().default(""),
    hits: integer("hits").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("redirects_from_idx").on(t.fromPath)],
);

/* -------------------------------------------------------------------------- */
/* Menu & offers                                                              */
/* -------------------------------------------------------------------------- */

export const menuCategories = pgTable("menu_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Short note shown under the category heading, e.g. "All are served with steak chips…". */
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  status: publishStatus("status").notNull().default("published"),
  ...timestamps,
});

export type MenuPrice = {
  /** Variant label, e.g. "330ml". Null for a single price. */
  label: string | null;
  /** Amount in pence. Null when the source text could not be read as a price and needs review. */
  amountPence: number | null;
};

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    prices: jsonb("prices").$type<MenuPrice[]>().notNull().default([]),
    /** Exact price text from the WordPress page. Shown when a price could not be parsed. */
    sourcePriceText: text("source_price_text").notNull().default(""),
    imageId: uuid("image_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    featured: boolean("featured").notNull().default(false),
    /** Hidden items stay in the admin but are not shown on the site (e.g. seasonal). */
    available: boolean("available").notNull().default(true),
    status: publishStatus("status").notNull().default("published"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Data-quality flag for owner review. Never auto-corrected. */
    reviewNote: text("review_note").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("menu_items_category_idx").on(t.categoryId, t.sortOrder)],
);

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull().default(""),
  body: text("body").notNull().default(""),
  priceText: text("price_text").notNull().default(""),
  promoCode: text("promo_code").notNull().default(""),
  /** "current" offers are shown; "upcoming" are listed as coming soon. */
  stage: text("stage").notNull().default("current"),
  imageId: uuid("image_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: publishStatus("status").notNull().default("published"),
  reviewNote: text("review_note").notNull().default(""),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Forms, submissions & newsletter                                            */
/* -------------------------------------------------------------------------- */

export const forms = pgTable("forms", {
  /** Stable key used in code and section blocks: contact, fan_club, table_request. */
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  /** Field definitions. See src/domain/forms/fields.ts. */
  fields: jsonb("fields").$type<unknown[]>().notNull().default([]),
  submitLabel: text("submit_label").notNull().default("Submit"),
  successMessage: text("success_message").notNull(),
  /** Overrides Business Settings → notification recipients when non-empty. */
  recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
  notifyAdmin: boolean("notify_admin").notNull().default(true),
  adminSubject: text("admin_subject").notNull(),
  sendAcknowledgement: boolean("send_acknowledgement").notNull().default(false),
  ackSubject: text("ack_subject").notNull().default(""),
  ackBody: text("ack_body").notNull().default(""),
  /** Days to keep submissions; null keeps them until deleted manually. */
  retentionDays: integer("retention_days"),
  ...timestamps,
});

export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formKey: text("form_key")
      .notNull()
      .references(() => forms.key, { onDelete: "restrict" }),
    /** Field name → value, as validated. Personal data: admin-only, never logged. */
    data: jsonb("data").$type<Record<string, string | boolean>>().notNull(),
    status: submissionStatus("status").notNull().default("new"),
    ipHash: text("ip_hash"),
    ...timestamps,
  },
  (t) => [index("submissions_form_idx").on(t.formKey, t.createdAt)],
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    status: subscriberStatus("status").notNull().default("pending"),
    /** Where they signed up: footer, popup:<id>, import:wordpress. */
    source: text("source").notNull().default(""),
    /** The exact consent wording shown at sign-up. Empty for legacy imports. */
    consentText: text("consent_text").notNull().default(""),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /** SHA-256 of the confirm/unsubscribe token. The raw token is only ever in the email link. */
    tokenHash: text("token_hash").notNull(),
    ipHash: text("ip_hash"),
    ...timestamps,
  },
  (t) => [uniqueIndex("subscribers_email_idx").on(t.email), index("subscribers_token_idx").on(t.tokenHash)],
);

/* -------------------------------------------------------------------------- */
/* Marketing (email + SMS campaigns)                                          */
/* -------------------------------------------------------------------------- */

export const marketingChannel = pgEnum("marketing_channel", ["email", "sms"]);
export const optInStatus = pgEnum("opt_in_status", ["subscribed", "unsubscribed"]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "sending", "sent", "cancelled"]);
export const sendStatus = pgEnum("send_status", ["pending", "sending", "sent", "failed", "skipped"]);

/**
 * Marketing contacts uploaded or added by staff (newsletter sign-ups stay in
 * newsletter_subscribers and are included at send time). Email and SMS consent are
 * tracked separately; an unsubscribed contact is never re-subscribed by an upload.
 */
export const marketingContacts = pgTable(
  "marketing_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().default(""),
    /** Lower-case. Null when only a phone number is known. */
    email: text("email"),
    /** E.164 (e.g. +447700900123). Null when only an email is known. */
    phone: text("phone"),
    emailStatus: optInStatus("email_status").notNull().default("subscribed"),
    smsStatus: optInStatus("sms_status").notNull().default("subscribed"),
    /** upload:<file>, manual, … */
    source: text("source").notNull().default(""),
    /** What the person agreed to and when/where, as confirmed by staff at upload. */
    consentNote: text("consent_note").notNull().default(""),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("marketing_contacts_email_idx").on(t.email), uniqueIndex("marketing_contacts_phone_idx").on(t.phone)],
);

export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: marketingChannel("channel").notNull(),
    name: text("name").notNull(),
    /** Email only. */
    subject: text("subject").notNull().default(""),
    /** Plain text (email: paragraphs separated by blank lines). */
    body: text("body").notNull().default(""),
    /** Optional button in emails. */
    ctaLabel: text("cta_label").notNull().default(""),
    ctaUrl: text("cta_url").notNull().default(""),
    /** Which lists to send to. */
    audience: jsonb("audience").$type<{ newsletter: boolean; contacts: boolean }>().notNull().default({ newsletter: true, contacts: true }),
    status: campaignStatus("status").notNull().default("draft"),
    total: integer("total").notNull().default(0),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("marketing_campaigns_created_idx").on(t.createdAt)],
);

/** One row per recipient per campaign: the send queue and its outcome. */
export const marketingSends = pgTable(
  "marketing_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketingCampaigns.id, { onDelete: "cascade" }),
    /** Email address or E.164 phone number. */
    recipient: text("recipient").notNull(),
    status: sendStatus("status").notNull().default("pending"),
    /** When a batch claimed this row (status "sending"); stale claims are released. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("marketing_sends_campaign_recipient_idx").on(t.campaignId, t.recipient), index("marketing_sends_status_idx").on(t.campaignId, t.status)],
);

/* -------------------------------------------------------------------------- */
/* Pop-ups                                                                    */
/* -------------------------------------------------------------------------- */

export const popups = pgTable("popups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  template: text("template").notNull().default("image_top"),
  heading: text("heading").notNull(),
  body: text("body").notNull().default(""),
  imageId: uuid("image_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  ctaLabel: text("cta_label").notNull().default(""),
  ctaHref: text("cta_href").notNull().default(""),
  /** Embedded form: "newsletter", a forms.key, or "" for none. */
  formKey: text("form_key").notNull().default(""),
  /** Paths where the pop-up may show ("/" , "/daisy"). Empty = every public page. */
  pages: jsonb("pages").$type<string[]>().notNull().default([]),
  trigger: popupTrigger("trigger").notNull().default("delay"),
  delaySeconds: integer("delay_seconds").notNull().default(5),
  scrollPercent: integer("scroll_percent").notNull().default(50),
  frequency: popupFrequency("frequency").notNull().default("session"),
  frequencyDays: integer("frequency_days").notNull().default(7),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  /** Higher wins when several pop-ups match a page; only one is ever shown. */
  priority: integer("priority").notNull().default(0),
  ...timestamps,
});

export const popupStats = pgTable(
  "popup_stats",
  {
    popupId: uuid("popup_id")
      .notNull()
      .references(() => popups.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    impressions: integer("impressions").notNull().default(0),
    dismissals: integer("dismissals").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.popupId, t.day] })],
);

/* -------------------------------------------------------------------------- */
/* Email log                                                                  */
/* -------------------------------------------------------------------------- */

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Prevents duplicate sends for the same event (e.g. "submission:<id>:admin"). */
    idempotencyKey: text("idempotency_key").notNull(),
    template: text("template").notNull(),
    provider: text("provider").notNull(),
    /** Recipient count only for customer mail; admin addresses are stored for troubleshooting. */
    recipientSummary: text("recipient_summary").notNull(),
    subject: text("subject").notNull(),
    status: emailStatus("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("email_log_idem_idx").on(t.idempotencyKey), index("email_log_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Audit & rate limiting                                                      */
/* -------------------------------------------------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    /** Never store secrets or submission contents here. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_action_idx").on(t.action)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '1 hour'`),
});
