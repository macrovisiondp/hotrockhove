import "server-only";
import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { emailConfigIssues } from "@/lib/email/providers";
import { env, turnstileConfigured } from "@/lib/env";
import { getSettingFresh } from "@/lib/settings";

export type Check = {
  id: string;
  label: string;
  /** blocker: must be fixed before launch · warn: should be reviewed · ok · info: optional */
  status: "ok" | "blocker" | "warn" | "info";
  detail: string;
  href: string;
};

/** Launch-readiness checklist built from real configuration and data. Nothing here is estimated. */
export async function readinessChecks(): Promise<Check[]> {
  const [business, notifications, email, seo, features, storage] = await Promise.all([
    getSettingFresh("business"),
    getSettingFresh("notifications"),
    getSettingFresh("email"),
    getSettingFresh("seo"),
    getSettingFresh("features"),
    getSettingFresh("storage"),
  ]);

  const [menuFlags] = await db.select({ n: count() }).from(t.menuItems).where(ne(t.menuItems.reviewNote, ""));
  const [offerFlags] = await db.select({ n: count() }).from(t.offers).where(and(ne(t.offers.reviewNote, ""), eq(t.offers.status, "published")));
  const pageFlags = await db
    .select({ slug: t.pages.slug, title: t.pages.title })
    .from(t.pages)
    .where(and(ne(t.pages.reviewNote, ""), eq(t.pages.status, "published")));
  const [unconfirmedRights] = await db.select({ n: count() }).from(t.mediaAssets).where(eq(t.mediaAssets.rightsStatus, "unconfirmed"));
  const [altMissing] = await db.select({ n: count() }).from(t.mediaAssets).where(eq(t.mediaAssets.altStatus, "missing"));
  const [altReview] = await db.select({ n: count() }).from(t.mediaAssets).where(eq(t.mediaAssets.altStatus, "needs_review"));
  const [localMedia] = await db.select({ n: count() }).from(t.mediaAssets).where(eq(t.mediaAssets.provider, "local"));
  const privacy = await db.query.pages.findFirst({ where: eq(t.pages.slug, "privacy-policy") });
  const [recentFailures] = await db
    .select({ n: count() })
    .from(t.emailLog)
    .where(and(eq(t.emailLog.status, "failed"), gt(t.emailLog.createdAt, sql`now() - interval '7 days'`)));

  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  add({
    id: "contact",
    label: "Contact details confirmed",
    status: business.confirmed.contact && (business.phone || business.email) ? "ok" : "blocker",
    detail: business.confirmed.contact
      ? "Phone, email and address have been confirmed."
      : "Imported from the old site. Check phone, email and address, then tick 'confirmed' (audit found conflicting numbers).",
    href: "/admin/business",
  });
  add({
    id: "hours",
    label: "Opening hours confirmed",
    status: business.hours.length === 0 ? "blocker" : business.confirmed.hours ? "ok" : "blocker",
    detail:
      business.hours.length === 0
        ? "No opening hours are set, so none are shown on the site."
        : business.confirmed.hours
          ? "Opening hours confirmed."
          : "The old site showed three different sets of hours. Confirm the correct ones.",
    href: "/admin/business#hours",
  });
  add({
    id: "socials",
    label: "Social links confirmed",
    status: business.confirmed.socials ? "ok" : "warn",
    detail: business.confirmed.socials ? "Social links confirmed." : "The Instagram link points to a Portsmouth account. Confirm or change it.",
    href: "/admin/business#social",
  });
  add({
    id: "recipients",
    label: "Notification recipients",
    status: notifications.recipients.length ? "ok" : "blocker",
    detail: notifications.recipients.length
      ? `Form notifications go to ${notifications.recipients.join(", ")}.`
      : "No staff inbox is set, so nobody is told about new enquiries.",
    href: "/admin/email",
  });
  const emailIssues = emailConfigIssues(email);
  add({
    id: "email",
    label: "Email delivery",
    status: emailIssues.length ? "blocker" : recentFailures.n > 0 ? "warn" : "ok",
    detail: emailIssues.length
      ? emailIssues.join(" ")
      : recentFailures.n > 0
        ? `${recentFailures.n} email(s) failed in the last 7 days. See the delivery log.`
        : "Configured, switched on and tested.",
    href: "/admin/email",
  });
  add({
    id: "turnstile",
    label: "Spam protection (Turnstile)",
    status: turnstileConfigured() ? "ok" : "warn",
    detail: turnstileConfigured()
      ? "Cloudflare Turnstile is active on public forms."
      : "Turnstile keys are not set (Vercel environment variables). Forms still use a honeypot and rate limits.",
    href: "/admin/site",
  });
  const cloudReady = storage.provider === "cloudinary" && storage.cloudinary.cloudName && storage.cloudinary.apiKey && storage.cloudinary.apiSecret;
  add({
    id: "storage",
    label: "Media storage",
    status: cloudReady && localMedia.n === 0 ? "ok" : "blocker",
    detail: !cloudReady
      ? "Cloudinary is not configured. Uploads only work in local development."
      : localMedia.n > 0
        ? `${localMedia.n} file(s) are still on local development storage. Run the media import against Cloudinary.`
        : "Cloudinary configured; all media is on Cloudinary.",
    href: "/admin/media/settings",
  });
  add({
    id: "privacy",
    label: "Privacy policy",
    status: privacy?.status !== "published" ? "blocker" : privacy.reviewNote ? "warn" : "ok",
    detail:
      privacy?.status !== "published"
        ? "No published privacy policy. Forms and the cookie banner link to it."
        : privacy.reviewNote
          ? "Published as a draft for review. Clear the review note once approved."
          : "Published and reviewed.",
    href: privacy ? `/admin/pages/${privacy.id}` : "/admin/pages",
  });
  add({
    id: "rights",
    label: "Image rights",
    status: unconfirmedRights.n ? "warn" : "ok",
    detail: unconfirmedRights.n
      ? `${unconfirmedRights.n} media file(s) have unconfirmed rights (theme stock photos or unknown sources).`
      : "All media rights confirmed.",
    href: "/admin/media?rights=unconfirmed",
  });
  add({
    id: "alt",
    label: "Image descriptions (alt text)",
    status: altMissing.n ? "warn" : altReview.n ? "warn" : "ok",
    detail:
      altMissing.n || altReview.n
        ? `${altMissing.n} missing, ${altReview.n} waiting for review.`
        : "Every image has a reviewed description.",
    href: "/admin/media?alt=attention",
  });
  add({
    id: "menu",
    label: "Menu data review",
    status: menuFlags.n ? "warn" : "ok",
    detail: menuFlags.n ? `${menuFlags.n} menu item(s) have review notes (e.g. "£5:99", "Bradon Rost").` : "No menu items flagged.",
    href: "/admin/menu?flagged=1",
  });
  add({
    id: "content",
    label: "Page and offer review notes",
    status: pageFlags.length || offerFlags.n ? "warn" : "ok",
    detail:
      pageFlags.length || offerFlags.n
        ? `${pageFlags.length} published page(s) and ${offerFlags.n} offer(s) have review notes${pageFlags.length ? ` (${pageFlags.map((p) => p.title).join(", ")})` : ""}.`
        : "Nothing flagged.",
    href: "/admin/pages",
  });
  add({
    id: "book",
    label: "Book Table link",
    status: business.bookTableUrl ? "ok" : "info",
    detail: business.bookTableUrl
      ? `Book Table opens ${business.bookTableUrl}.`
      : "No booking-system URL yet (separate project). Book Table uses the table-request form until it's set.",
    href: "/admin/business#booking",
  });
  add({
    id: "reviews",
    label: "Google reviews widget",
    status: features.reviewsEnabled && features.reviewsEmbedSrc ? "ok" : "info",
    detail:
      features.reviewsEnabled && features.reviewsEmbedSrc
        ? "Trustindex widget enabled (loads after cookie consent)."
        : "Optional: paste the Trustindex embed script URL to show Google reviews.",
    href: "/admin/site",
  });
  add({
    id: "maintenance",
    label: "Maintenance mode",
    status: features.maintenanceMode ? "warn" : "ok",
    detail: features.maintenanceMode ? "On: visitors see the maintenance page." : "Off.",
    href: "/admin/site",
  });
  add({
    id: "indexing",
    label: "Search engine indexing",
    status: seo.allowIndexing ? "ok" : "info",
    detail: seo.allowIndexing ? "Search engines may index the site." : "Off until launch: every page is noindex and robots.txt blocks crawling.",
    href: "/admin/seo",
  });
  add({
    id: "app-url",
    label: "Site address",
    status: env().APP_URL.startsWith("https://") ? "ok" : "info",
    detail: `APP_URL is ${env().APP_URL}. Production should be https://hotrockhove.com.`,
    href: "/admin/site",
  });
  return checks;
}
