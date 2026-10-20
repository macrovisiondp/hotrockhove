import Link from "next/link";
import { getNav } from "@/domain/content";
import { getBookTarget, resolveHref } from "@/domain/links";
import { NEWSLETTER_CONSENT } from "@/domain/newsletter";
import { getClientPopups, getOverlayPaths, getPrivacyHref } from "@/domain/site-chrome";
import { env } from "@/lib/env";
import { getSetting, telHref } from "@/lib/settings";
import { Analytics, ConsentBanner } from "@/components/site/consent";
import { Footer } from "@/components/site/footer";
import { MobileActions } from "@/components/site/mobile-actions";
import { PopupHost } from "@/components/site/popup-host";
import { SiteHeader } from "@/components/site/site-header";
import { submitFormAction, subscribeAction } from "./actions";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [business, brand, consent, features, headerNav, footerNav, book, overlayPaths, privacyHref] = await Promise.all([
    getSetting("business"),
    getSetting("brand"),
    getSetting("consent"),
    getSetting("features"),
    getNav("header"),
    getNav("footer"),
    getBookTarget(),
    getOverlayPaths(),
    getPrivacyHref(),
  ]);
  const { popups, forms } = await getClientPopups(book);
  const phoneHref = business.phone ? telHref(business.phone) : null;
  const bookLink = headerNav.find((l) => l.href === "book");
  const turnstileSiteKey = env().TURNSTILE_SECRET_KEY ? (env().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null;
  const submitForm = Object.fromEntries(Object.keys(forms).map((k) => [k, submitFormAction.bind(null, k)]));
  const announcement = features.announcementEnabled && features.announcementText ? features : null;

  return (
    <div className="site relative min-h-[100dvh]" style={{ ["--brand-accent" as string]: brand.accentColour }}>
      <a href="#main" className="sr-only z-[60] bg-bronze px-4 py-3 text-ink-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      {announcement && (
        <div className="relative z-[11] bg-bronze text-ink-950">
          <p className="mx-auto max-w-[1400px] px-4 py-2 text-center text-sm font-medium">
            {announcement.announcementHref ? (
              <Link href={resolveHref(announcement.announcementHref, book).href} className="underline underline-offset-4">
                {announcement.announcementText}
              </Link>
            ) : (
              announcement.announcementText
            )}
          </p>
        </div>
      )}
      <SiteHeader
        links={headerNav.map((l) => ({ ...l, ...resolveHref(l.href, book), isBook: l.href === "book" }))}
        logoUrl={brand.logoUrl}
        brandName={business.name}
        phoneHref={phoneHref}
        overlayPaths={announcement ? [] : overlayPaths}
      />
      <main id="main">{children}</main>
      <Footer business={business} links={footerNav} logoUrl={brand.logoUrl} />
      <MobileActions phoneHref={phoneHref} book={book} bookLabel={bookLink?.label ?? "Book"} />
      <ConsentBanner text={consent.bannerText} policyHref={privacyHref} />
      <Analytics provider={consent.analyticsProvider} id={consent.analyticsId} domain={new URL(env().APP_URL).hostname} />
      {popups.length > 0 && (
        <PopupHost
          popups={popups}
          forms={forms}
          submitForm={submitForm}
          subscribe={subscribeAction.bind(null, "popup")}
          newsletterConsent={NEWSLETTER_CONSENT}
          turnstileSiteKey={turnstileSiteKey}
          privacyHref={privacyHref}
        />
      )}
    </div>
  );
}
