import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { PublicMedia, PublicMenuCategory } from "@/domain/content";
import type { FormField } from "@/domain/forms/fields";
import type { BookTarget } from "@/domain/links";
import { resolveHref } from "@/domain/links";
import { NEWSLETTER_CONSENT } from "@/domain/newsletter";
import type { Cta, Section, SectionOf } from "@/domain/sections";
import type { BusinessSettings, FeatureSettings, ReviewsSettings } from "@/lib/settings";
import { formatAddress, groupHours, telHref } from "@/lib/settings";
import { submitFormAction, subscribeAction } from "@/app/(site)/actions";
import { ConsentFrame } from "./consent-frame";
import { GalleryGrid } from "./gallery-grid";
import { HeroVideo } from "./hero-video";
import { MediaImage, MediaVideo, cloudinaryTransform } from "./media";
import { MenuNav } from "./menu-nav";
import { NewsletterForm } from "./newsletter-form";
import { PublicForm } from "./public-form";
import { ReviewsEmbed } from "./reviews-embed";
import { GoogleG, ReviewsList, Stars } from "./reviews-list";
import { RichText } from "./rich-text";

export type Offer = {
  id: string;
  title: string;
  tagline: string;
  body: string;
  priceText: string;
  promoCode: string;
  stage: string;
  imageId: string | null;
};

export type SectionContext = {
  media: Map<string, PublicMedia>;
  book: BookTarget;
  business: BusinessSettings;
  features: FeatureSettings;
  reviews: ReviewsSettings;
  /** The homepage: its hero shows the Google rating badge. */
  isHome: boolean;
  privacyHref: string | null;
  turnstileSiteKey: string | null;
  menu: PublicMenuCategory[];
  offers: Offer[];
  forms: Record<string, { name: string; fields: FormField[]; submitLabel: string }>;
};

const wrap = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10";

function CtaLink({ cta, ctx, variant }: { cta: Cta; ctx: SectionContext; variant: "primary" | "ghost" }) {
  if (!cta.label || !cta.href) return null;
  const { href, external } = resolveHref(cta.href, ctx.book);
  return (
    <Link href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})} className={`btn btn-${variant}`}>
      {cta.label}
    </Link>
  );
}

function Heading({ eyebrow, heading, className = "", as: As = "h2" }: { eyebrow?: string; heading: string; className?: string; as?: "h1" | "h2" }) {
  if (!heading && !eyebrow) return null;
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      {heading && <As className="display text-4xl text-bone sm:text-5xl lg:text-[3.6rem]">{heading}</As>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Hero({ s, ctx, first }: { s: SectionOf<"hero">; ctx: SectionContext; first: boolean }) {
  const img = s.mediaId ? ctx.media.get(s.mediaId) : undefined;
  const vid = s.videoId ? ctx.media.get(s.videoId) : undefined;
  const hasMedia = Boolean(img || vid);
  const H = first ? "h1" : "h2";
  if (img && s.mediaStyle === "float") {
    // Cut-out image (e.g. Daisy's balloon) drifting beside the text. "lighten" blends a
    // black photo background into the dark page so only the subject shows.
    return (
      <section className="relative isolate overflow-hidden">
        {/* Opaque base: the section is an isolated layer, so the blend needs a solid backdrop inside it. */}
        <div className="absolute inset-0 -z-10 bg-ink-950 bg-[radial-gradient(ellipse_at_70%_45%,rgb(160_82_45/0.18),transparent_60%)]" />
        <div className={`${wrap} grid min-h-[80dvh] items-center gap-8 pb-16 pt-32 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-36`}>
          <div className="max-w-3xl animate-rise">
            {s.eyebrow && <p className="eyebrow mb-5">{s.eyebrow}</p>}
            <H className="display text-5xl text-bone sm:text-6xl lg:text-[5.2rem]">{s.heading}</H>
            {s.body && <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-bone/85">{s.body}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              <CtaLink cta={s.primaryCta} ctx={ctx} variant="primary" />
              <CtaLink cta={s.secondaryCta} ctx={ctx} variant="ghost" />
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[520px] animate-float mix-blend-lighten">
            <MediaImage media={img} sizes="(min-width: 1024px) 40vw, 90vw" priority={first} fit="contain" />
          </div>
        </div>
      </section>
    );
  }
  if (!hasMedia) {
    return (
      <section className={`${wrap} pb-12 pt-32 lg:pb-16 lg:pt-40`}>
        {s.eyebrow && <p className="eyebrow mb-5">{s.eyebrow}</p>}
        <H className="display max-w-4xl text-5xl text-bone sm:text-6xl lg:text-7xl">{s.heading}</H>
        {s.body && <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-stone">{s.body}</p>}
        <div className="mt-9 flex flex-wrap gap-3">
          <CtaLink cta={s.primaryCta} ctx={ctx} variant="primary" />
          <CtaLink cta={s.secondaryCta} ctx={ctx} variant="ghost" />
        </div>
      </section>
    );
  }
  return (
    <section className="relative isolate flex min-h-[88dvh] items-end overflow-hidden lg:min-h-[94dvh]">
      <div className="absolute inset-0 -z-10">
        {img && <MediaImage media={img} sizes="100vw" priority={first} />}
        {vid && <HeroVideo src={cloudinaryTransform(vid.url, "q_auto,vc_auto,w_1600")} poster={vid.posterUrl ?? img?.url ?? null} type={vid.mimeType} />}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(11_10_9/0.55)_0%,rgb(11_10_9/0.1)_35%,rgb(11_10_9/0.55)_70%,rgb(11_10_9/0.96)_100%)]" />
      </div>
      <div className={`${wrap} pb-16 pt-40 lg:pb-24`}>
        <div className="max-w-3xl animate-rise">
          {s.eyebrow && <p className="eyebrow mb-5">{s.eyebrow}</p>}
          <H className="display text-5xl text-bone sm:text-6xl lg:text-[5.2rem]">{s.heading}</H>
          {s.body && <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-bone/85">{s.body}</p>}
          <div className="mt-9 flex flex-wrap gap-3">
            <CtaLink cta={s.primaryCta} ctx={ctx} variant="primary" />
            <CtaLink cta={s.secondaryCta} ctx={ctx} variant="ghost" />
          </div>
          {ctx.isHome && first && <RatingBadge reviews={ctx.reviews} />}
        </div>
      </div>
    </section>
  );
}

/** "Google ★★★★★ Excellent · 125 Google reviews", linking to the reviews section. */
function RatingBadge({ reviews }: { reviews: ReviewsSettings }) {
  if (!reviews.summaryLabel || reviews.items.every((r) => r.hidden)) return null;
  return (
    <a href="#reviews" className="mt-8 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-bone/90 hover:text-bone">
      <GoogleG size={18} />
      <Stars rating={5} size={15} label={false} />
      <span>
        <strong className="font-semibold">{reviews.summaryLabel}</strong>
        {reviews.totalCount > 0 && <> · {reviews.totalCount} Google reviews</>}
      </span>
    </a>
  );
}

function Story({ s, ctx }: { s: SectionOf<"story">; ctx: SectionContext }) {
  const img = s.mediaId ? ctx.media.get(s.mediaId) : undefined;
  const imageFirst = s.imageSide === "left";
  return (
    <section className={`${wrap} py-24 lg:py-36`}>
      <div className={`grid items-start gap-12 lg:gap-20 ${img ? "lg:grid-cols-[5fr_6fr]" : ""}`}>
        {img && (
          <div className={`${imageFirst ? "" : "lg:order-2"} lg:sticky lg:top-32`}>
            <div className="reveal relative aspect-[4/5] overflow-hidden bg-ink-900">
              <MediaImage media={img} sizes="(min-width: 1024px) 42vw, 100vw" />
            </div>
          </div>
        )}
        <div className={`max-w-[62ch] ${imageFirst ? "" : "lg:order-1"} lg:pt-8`}>
          <Heading eyebrow={s.eyebrow} heading={s.heading} />
          <RichText text={s.body} className="mt-8 text-[1.06rem] leading-[1.8] text-stone" />
          {s.signature && (
            <div className="mt-10 border-t border-ink-700 pt-6">
              <p className="display text-3xl italic text-bone">{s.signature}</p>
              {s.signatureRole && <p className="mt-1 text-sm text-mute">{s.signatureRole}</p>}
            </div>
          )}
          {s.cta.label && (
            <div className="mt-10">
              <CtaLink cta={s.cta} ctx={ctx} variant="ghost" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TextBlock({ s }: { s: SectionOf<"text"> }) {
  const center = s.align === "center";
  return (
    <section className={`${wrap} py-20 lg:py-28`}>
      <div className={`max-w-[68ch] ${center ? "mx-auto text-center" : ""}`}>
        <Heading eyebrow={s.eyebrow} heading={s.heading} />
        <RichText text={s.body} className={`${s.heading ? "mt-8" : ""} text-[1.06rem] leading-[1.8] text-stone`} />
      </div>
    </section>
  );
}

function Quote({ s }: { s: SectionOf<"quote"> }) {
  return (
    <section className="border-y border-ink-800 bg-ink-900">
      <figure className={`${wrap} py-20 text-center lg:py-28`}>
        <div className="mx-auto mb-8 h-px w-16 bg-bronze" aria-hidden />
        <blockquote className="display mx-auto max-w-4xl text-4xl italic leading-[1.15] text-bone sm:text-5xl lg:text-6xl">{s.quote}</blockquote>
        {s.attribution && <figcaption className="mt-8 text-sm uppercase tracking-[0.2em] text-mute">{s.attribution}</figcaption>}
      </figure>
    </section>
  );
}

function VideoFeature({ s, ctx }: { s: SectionOf<"video">; ctx: SectionContext }) {
  const found = s.videoId ? ctx.media.get(s.videoId) : undefined;
  if (!found) return null;
  const poster = s.mediaId ? ctx.media.get(s.mediaId) : undefined;
  const vid = poster && !found.posterUrl ? { ...found, posterUrl: poster.url } : found;
  const portrait = (vid.height ?? 0) > (vid.width ?? 0);
  return (
    <section className={`${wrap} py-24 lg:py-32`}>
      <div className={`grid items-center gap-10 lg:gap-16 ${portrait ? "lg:grid-cols-[1fr_minmax(0,420px)]" : ""}`}>
        <div className={portrait ? "" : "max-w-3xl"}>
          <Heading eyebrow={s.eyebrow} heading={s.heading} />
          {s.body && <RichText text={s.body} className="mt-6 text-[1.06rem] leading-[1.8] text-stone" />}
        </div>
        <div className={`reveal overflow-hidden bg-ink-900 ${portrait ? "aspect-[9/16] w-full" : "mt-10 aspect-video lg:mt-14"}`}>
          <MediaVideo media={vid} />
        </div>
      </div>
    </section>
  );
}

function PriceRow({ name, price, description, image }: { name: string; price: string; description: string; image?: PublicMedia }) {
  // Items without a photo keep the plain text layout.
  if (image) {
    return (
      <div className="flex gap-4 sm:gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-ink-900 sm:h-24 sm:w-24">
          <MediaImage media={image} sizes="96px" />
        </div>
        <div className="min-w-0 flex-1">
          <PriceRow name={name} price={price} description={description} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <h4 className="display text-[1.45rem] leading-tight text-bone">{name}</h4>
        <span aria-hidden className="mb-1.5 min-w-6 flex-1 border-b border-dotted border-ink-600" />
        <span className="shrink-0 font-medium tabular-nums text-bronze">{price}</span>
      </div>
      {description && <p className="mt-1.5 max-w-[56ch] text-[0.95rem] leading-relaxed text-stone">{description}</p>}
    </div>
  );
}

function MenuHighlights({ s, ctx }: { s: SectionOf<"menuHighlights">; ctx: SectionContext }) {
  const featured = ctx.menu.flatMap((c) => c.items.filter((i) => i.featured));
  if (featured.length === 0) return null;
  const withImage = featured.find((i) => i.imageId && ctx.media.get(i.imageId));
  const img = withImage?.imageId ? ctx.media.get(withImage.imageId) : undefined;
  return (
    <section className="bg-ink-900 py-24 lg:py-32">
      <div className={`${wrap} grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-20`}>
        <div>
          <Heading eyebrow={s.eyebrow} heading={s.heading} />
          {s.body && <p className="mt-6 max-w-[48ch] leading-relaxed text-stone">{s.body}</p>}
          {img && (
            <div className="reveal relative mt-10 hidden aspect-[4/3] overflow-hidden lg:block">
              <MediaImage media={img} sizes="40vw" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <div className="space-y-8">
            {featured.slice(0, 6).map((i) => (
              <PriceRow key={i.id} name={i.name} price={i.priceText} description={i.description} />
            ))}
          </div>
          {s.cta.label && (
            <div className="mt-12">
              <CtaLink cta={s.cta} ctx={ctx} variant="primary" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FullMenu({ s, ctx, first }: { s: SectionOf<"menu">; ctx: SectionContext; first: boolean }) {
  const H = first ? "h1" : "h2";
  return (
    <section className={`${wrap} pb-24 ${first ? "pt-32 lg:pt-40" : "pt-20"}`}>
      <header className="mb-12 max-w-3xl">
        {s.eyebrow && <p className="eyebrow mb-4">{s.eyebrow}</p>}
        <H className="display text-5xl text-bone sm:text-6xl lg:text-7xl">{s.heading || "Menu"}</H>
        {s.body && <RichText text={s.body} className="mt-6 text-lg leading-relaxed text-stone" />}
      </header>
      {ctx.menu.length === 0 ? (
        <p className="text-stone">The menu is being updated. Please call us for today&apos;s dishes.</p>
      ) : (
        <>
          <MenuNav categories={ctx.menu.map((c) => ({ id: c.id, name: c.name }))} />
          <div className="mt-4">
            {ctx.menu.map((c) => (
              <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-h-${c.id}`} className="scroll-mt-[150px] border-b border-ink-800 py-14 last:border-b-0 lg:py-20">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-16">
                  <div>
                    <h3 id={`cat-h-${c.id}`} className="text-sm font-semibold uppercase tracking-[0.24em] text-bronze">
                      {c.name}
                    </h3>
                    {c.note && <p className="mt-3 text-[0.95rem] leading-relaxed text-stone">{c.note}</p>}
                  </div>
                  <div className="grid gap-x-14 gap-y-9 md:grid-cols-2">
                    {c.items.map((i) => (
                      <PriceRow
                        key={i.id}
                        name={i.name}
                        price={i.priceText}
                        description={i.description}
                        image={i.imageId ? ctx.media.get(i.imageId) : undefined}
                      />
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
          <p className="mt-10 max-w-[70ch] text-sm leading-relaxed text-mute">
            Please tell your server about any allergies or dietary requirements before ordering.
          </p>
        </>
      )}
    </section>
  );
}

function Offers({ s, ctx }: { s: SectionOf<"offers">; ctx: SectionContext }) {
  const current = ctx.offers.filter((o) => o.stage !== "upcoming");
  const upcoming = ctx.offers.filter((o) => o.stage === "upcoming");
  if (ctx.offers.length === 0) return null;
  return (
    <section className={`${wrap} py-24 lg:py-32`}>
      <Heading eyebrow={s.eyebrow} heading={s.heading} className="max-w-3xl" />
      {s.body && <RichText text={s.body} className="mt-6 max-w-[62ch] leading-relaxed text-stone" />}
      <div className="mt-14 grid gap-px bg-ink-700 md:grid-cols-2">
        {current.map((o) => {
          const img = o.imageId ? ctx.media.get(o.imageId) : undefined;
          return (
            <article key={o.id} className="flex gap-5 bg-ink-950 p-6 sm:gap-7 lg:p-8">
              {/* Small square thumbnail; offers without a photo get the brand mark instead. */}
              <div className="relative aspect-square w-24 shrink-0 self-start overflow-hidden bg-ink-900 sm:w-36 lg:w-40">
                {img ? (
                  <MediaImage media={img} sizes="(min-width: 1024px) 160px, (min-width: 640px) 144px, 96px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center border border-ink-800" aria-hidden>
                    <div className="relative h-1/2 w-1/2 opacity-40">
                      <Image src="/brand/logo-white.png" alt="" fill sizes="80px" className="object-contain" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="display text-2xl text-bone sm:text-3xl">{o.title}</h3>
                {o.tagline && <p className="mt-1.5 text-bronze">{o.tagline}</p>}
                {o.body && <RichText text={o.body} className="mt-4 flex-1 text-[0.95rem] leading-relaxed text-stone" />}
                {(o.priceText || o.promoCode) && (
                  <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-ink-800 pt-5">
                    {o.priceText ? <p className="display text-3xl text-bone">{o.priceText}</p> : <span />}
                    {o.promoCode && (
                      <p className="text-sm text-stone">
                        Code <span className="ml-1 border border-bronze/60 px-2 py-1 font-semibold tracking-[0.14em] text-bone">{o.promoCode}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {upcoming.length > 0 && (
        <div className="mt-14">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-mute">Coming soon</h3>
          <ul className="mt-5 flex flex-wrap gap-3">
            {upcoming.map((o) => (
              <li key={o.id} className="border border-ink-700 px-4 py-2 text-stone">
                {o.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Gallery({ s, ctx, first }: { s: SectionOf<"gallery">; ctx: SectionContext; first: boolean }) {
  const items = s.mediaIds.map((id) => ctx.media.get(id)).filter(Boolean) as PublicMedia[];
  if (items.length === 0) return null;
  const shown = s.limit > 0 ? items.slice(0, s.limit) : items;
  const H = first ? "h1" : "h2";
  return (
    <section className={`${wrap} ${first ? "pb-24 pt-32 lg:pt-40" : "py-24 lg:py-32"}`}>
      {(s.heading || s.eyebrow) && (
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            {s.eyebrow && <p className="eyebrow mb-4">{s.eyebrow}</p>}
            {s.heading && <H className="display text-5xl text-bone sm:text-6xl">{s.heading}</H>}
          </div>
          {s.limit > 0 && s.cta.label && (
            <Link href={resolveHref(s.cta.href, ctx.book).href} className="group inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em] text-bone">
              {s.cta.label}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>
      )}
      <GalleryGrid items={shown} />
    </section>
  );
}

function Reviews({ s, ctx }: { s: SectionOf<"reviews">; ctx: SectionContext }) {
  const { features, reviews } = ctx;
  const widget = Boolean(features.reviewsEnabled && features.reviewsEmbedSrc);
  const items = reviews.items.filter((r) => !r.hidden);
  if (!widget && items.length === 0) return null;
  return (
    <section id="reviews" className="scroll-mt-24 border-y border-ink-800 py-24 lg:py-32">
      <div className={wrap}>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <Heading eyebrow={s.eyebrow} heading={s.heading} className="max-w-2xl" />
          {!widget && reviews.summaryLabel && (
            <div className="flex items-center gap-4">
              <GoogleG size={34} />
              <div>
                <p className="flex items-center gap-2">
                  <span className="text-lg font-semibold uppercase tracking-[0.14em] text-bone">{reviews.summaryLabel}</span>
                  <Stars rating={5} size={18} label={false} />
                </p>
                {reviews.totalCount > 0 && <p className="text-sm text-stone">Based on {reviews.totalCount} Google reviews</p>}
              </div>
            </div>
          )}
        </div>
        {widget ? <ReviewsEmbed src={features.reviewsEmbedSrc} /> : <ReviewsList items={items} />}
        {!widget && reviews.googleUrl && (
          <div className="mt-10">
            <a href={reviews.googleUrl} target="_blank" rel="noopener" className="btn btn-ghost">
              Read all reviews on Google
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function ContactDetails({ business, compact = false }: { business: BusinessSettings; compact?: boolean }) {
  const address = formatAddress(business);
  const hours = business.hours.length ? groupHours(business.hours) : [];
  return (
    <div className={`grid gap-10 ${compact ? "" : "sm:grid-cols-2"}`}>
      {(address || business.phone || business.email) && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-bronze">Contact</h3>
          <address className="mt-4 space-y-2 not-italic leading-relaxed text-stone">
            {address && <p>{address}</p>}
            {business.phone && (
              <p>
                <a href={telHref(business.phone)} className="link-underline text-bone">
                  {business.phone}
                </a>
              </p>
            )}
            {business.email && (
              <p>
                <a href={`mailto:${business.email}`} className="link-underline break-all text-bone">
                  {business.email}
                </a>
              </p>
            )}
          </address>
        </div>
      )}
      {hours.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-bronze">Opening hours</h3>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-stone">
            {hours.map((h) => (
              <div key={h.label} className="contents">
                <dt>{h.label}</dt>
                <dd className="whitespace-nowrap tabular-nums text-bone">{h.value}</dd>
              </div>
            ))}
          </dl>
          {business.hoursNote && <p className="mt-3 text-sm text-mute">{business.hoursNote}</p>}
        </div>
      )}
    </div>
  );
}

function Visit({ s, ctx }: { s: SectionOf<"visit">; ctx: SectionContext }) {
  const img = s.mediaId ? ctx.media.get(s.mediaId) : undefined;
  const b = ctx.business;
  const address = formatAddress(b);
  if (!address && !b.phone && b.hours.length === 0) return null;
  return (
    <section className="relative isolate overflow-hidden border-t border-ink-800">
      <div className={`grid lg:grid-cols-2`}>
        <div className={`px-4 py-24 sm:px-6 lg:py-32 lg:pl-10 lg:pr-16 xl:pl-[max(2.5rem,calc((100vw-1400px)/2+2.5rem))]`}>
          <Heading eyebrow={s.eyebrow} heading={s.heading} />
          {s.body && <p className="mt-6 max-w-[48ch] leading-relaxed text-stone">{s.body}</p>}
          <div className="mt-12">
            <ContactDetails business={b} />
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <CtaLink cta={{ label: "Book Table", href: "book" }} ctx={ctx} variant="primary" />
            {b.mapUrl && (
              <a href={b.mapUrl} target="_blank" rel="noopener" className="btn btn-ghost">
                <MapPin size={18} aria-hidden />
                Directions
              </a>
            )}
          </div>
        </div>
        {s.showMap && address ? (
          <div className="relative h-[420px] lg:h-auto lg:min-h-full">
            <ConsentFrame
              src={googleMapEmbed(address)}
              title={`Map: ${address}`}
              loadLabel="Show map"
              notice="The map is provided by Google, which may set its own cookies."
              className="absolute inset-0 grayscale-[35%]"
            />
          </div>
        ) : (
          img && (
            <div className="relative min-h-[360px] lg:min-h-full">
              <MediaImage media={img} sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
          )
        )}
      </div>
    </section>
  );
}

/** Keyless Google Maps embed for an address (same kind of map the old site used). */
function googleMapEmbed(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
}

/** A photo story: alternating rows of photos (or a video) and a numbered caption. */
function Journey({ s, ctx }: { s: SectionOf<"journey">; ctx: SectionContext }) {
  const steps = s.steps
    .map((st) => ({ ...st, media: st.mediaIds.map((id) => ctx.media.get(id)).filter(Boolean) as PublicMedia[] }))
    .filter((st) => st.media.length > 0 || st.caption);
  if (steps.length === 0) return null;
  return (
    <section className="relative overflow-hidden bg-ink-900 py-24 lg:py-36">
      <div className={wrap}>
        <div className="mx-auto max-w-3xl text-center">
          <Heading eyebrow={s.eyebrow} heading={s.heading} />
          {s.body && <RichText text={s.body} className="mx-auto mt-6 max-w-[56ch] text-lg leading-relaxed text-stone" />}
        </div>
        <div className="relative mt-16 lg:mt-24">
          {/* Thin timeline down the middle on large screens. */}
          <span aria-hidden className="absolute bottom-0 left-1/2 top-0 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-ink-600 to-transparent lg:block" />
          <ol className="relative space-y-20 lg:space-y-32">
            {steps.map((st, i) => {
              const flip = i % 2 === 1;
              return (
                <li key={st.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-24">
                  <div className={`reveal ${flip ? "lg:order-2" : ""}`}>
                    <JourneyMedia media={st.media} />
                  </div>
                  <div className={flip ? "lg:order-1 lg:text-right" : ""}>
                    <p className="display text-6xl leading-none text-bronze/70 lg:text-7xl" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    {st.caption && <p className={`display mt-4 max-w-[22ch] text-3xl leading-snug text-bone lg:text-4xl ${flip ? "lg:ml-auto" : ""}`}>{st.caption}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function JourneyMedia({ media }: { media: PublicMedia[] }) {
  const video = media.find((m) => m.mimeType.startsWith("video/"));
  if (video) {
    const portrait = (video.height ?? 0) > (video.width ?? 0);
    return (
      <div className={`overflow-hidden bg-ink-950 ${portrait ? "mx-auto aspect-[9/16] w-full max-w-[380px]" : "aspect-video"}`}>
        <MediaVideo media={video} />
      </div>
    );
  }
  const tall = (m: PublicMedia) => (m.height ?? 0) > (m.width ?? 0);
  if (media.length === 1) {
    const m = media[0];
    return (
      <div className={`relative overflow-hidden bg-ink-950 ${tall(m) ? "mx-auto aspect-[4/5] w-full max-w-[460px]" : "aspect-[16/9]"}`}>
        <MediaImage media={m} sizes="(min-width: 1024px) 45vw, 100vw" />
      </div>
    );
  }
  // Two or three photos: a staggered set of tall frames.
  return (
    <div className={`grid gap-3 pb-10 sm:gap-4 ${media.length === 3 ? "grid-cols-3" : "mx-auto max-w-[560px] grid-cols-2"}`}>
      {media.map((m, i) => (
        <div key={m.id} className={`relative aspect-[9/16] overflow-hidden bg-ink-950 ${i % 2 === 1 ? "translate-y-6 lg:translate-y-10" : ""}`}>
          <MediaImage media={m} sizes="(min-width: 1024px) 22vw, 45vw" />
        </div>
      ))}
    </div>
  );
}

function Tour({ s, ctx }: { s: SectionOf<"tour">; ctx: SectionContext }) {
  const { vrTourEnabled, vrTourUrl } = ctx.features;
  if (!vrTourEnabled || !vrTourUrl) return null;
  const poster = s.mediaId ? ctx.media.get(s.mediaId) : undefined;
  return (
    <section className={`${wrap} py-24 lg:py-32`}>
      <div className="max-w-3xl">
        <Heading eyebrow={s.eyebrow} heading={s.heading} />
        {s.body && <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-stone">{s.body}</p>}
      </div>
      <div className="reveal relative mt-12 aspect-[4/5] w-full overflow-hidden border border-ink-800 bg-ink-900 sm:aspect-video">
        <ConsentFrame
          src={vrTourUrl}
          title={s.heading ? `${s.heading}: 360° virtual tour` : "360° virtual tour"}
          loadLabel="Start the 3D tour"
          notice="The 360° tour is hosted by a third party, which may set its own cookies."
          allow="fullscreen; gyroscope; accelerometer; xr-spatial-tracking"
          className="absolute inset-0"
          backdrop={poster ? <MediaImage media={poster} sizes="(min-width: 1400px) 1320px, 100vw" /> : undefined}
        />
      </div>
    </section>
  );
}

function CtaBand({ s, ctx }: { s: SectionOf<"cta">; ctx: SectionContext }) {
  const img = s.mediaId ? ctx.media.get(s.mediaId) : undefined;
  return (
    <section className="relative isolate overflow-hidden">
      {img && (
        <div className="absolute inset-0 -z-10">
          <MediaImage media={img} sizes="100vw" />
          <div className="absolute inset-0 bg-ink-950/70" />
        </div>
      )}
      <div className={`${wrap} py-28 text-center lg:py-40 ${img ? "" : "border-y border-ink-800"}`}>
        <h2 className="display mx-auto max-w-3xl text-5xl text-bone sm:text-6xl">{s.heading}</h2>
        {s.body && <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed text-bone/80">{s.body}</p>}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <CtaLink cta={s.primaryCta} ctx={ctx} variant="primary" />
          <CtaLink cta={s.secondaryCta} ctx={ctx} variant="ghost" />
        </div>
      </div>
    </section>
  );
}

function FormSection({ s, ctx, first }: { s: SectionOf<"form">; ctx: SectionContext; first: boolean }) {
  const form = ctx.forms[s.formKey];
  const H = first ? "h1" : "h2";
  return (
    <section className={`${wrap} ${first ? "pb-24 pt-32 lg:pb-32 lg:pt-40" : "py-24 lg:py-32"}`}>
      <div className={`grid gap-14 ${s.showContact ? "lg:grid-cols-[1fr_1.15fr] lg:gap-24" : "max-w-3xl"}`}>
        <div>
          {s.eyebrow && <p className="eyebrow mb-4">{s.eyebrow}</p>}
          {s.heading && <H className="display text-5xl text-bone sm:text-6xl">{s.heading}</H>}
          {s.body && <RichText text={s.body} className="mt-6 max-w-[52ch] text-lg leading-relaxed text-stone" />}
          {s.showContact && (
            <div className="mt-12">
              <ContactDetails business={ctx.business} compact />
            </div>
          )}
        </div>
        <div>
          {form ? (
            <PublicForm
              action={submitFormAction.bind(null, s.formKey)}
              fields={form.fields}
              submitLabel={form.submitLabel}
              turnstileSiteKey={ctx.turnstileSiteKey}
              privacyHref={ctx.privacyHref}
            />
          ) : (
            <p className="border border-ink-700 p-6 text-stone">
              This form isn&apos;t available right now.
              {ctx.business.phone && (
                <>
                  {" "}
                  Please call us on{" "}
                  <a href={telHref(ctx.business.phone)} className="text-bone underline underline-offset-4">
                    {ctx.business.phone}
                  </a>
                  .
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ s, ctx }: { s: SectionOf<"newsletter">; ctx: SectionContext }) {
  return (
    <section className="border-t border-ink-800 bg-ink-900">
      <div className={`${wrap} grid gap-10 py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20 lg:py-24`}>
        <div>
          <h2 className="display text-4xl text-bone sm:text-5xl">{s.heading}</h2>
          {s.body && <p className="mt-4 max-w-[48ch] leading-relaxed text-stone">{s.body}</p>}
        </div>
        <NewsletterForm
          action={subscribeAction.bind(null, "section")}
          consentText={NEWSLETTER_CONSENT}
          turnstileSiteKey={ctx.turnstileSiteKey}
          privacyHref={ctx.privacyHref}
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export function RenderSections({ sections, ctx }: { sections: Section[]; ctx: SectionContext }) {
  return (
    <>
      {sections.map((s, i) => {
        const first = i === 0;
        switch (s.type) {
          case "hero":
            return <Hero key={s.id} s={s} ctx={ctx} first={first} />;
          case "story":
            return <Story key={s.id} s={s} ctx={ctx} />;
          case "text":
            return <TextBlock key={s.id} s={s} />;
          case "quote":
            return <Quote key={s.id} s={s} />;
          case "video":
            return <VideoFeature key={s.id} s={s} ctx={ctx} />;
          case "menuHighlights":
            return <MenuHighlights key={s.id} s={s} ctx={ctx} />;
          case "menu":
            return <FullMenu key={s.id} s={s} ctx={ctx} first={first} />;
          case "offers":
            return <Offers key={s.id} s={s} ctx={ctx} />;
          case "gallery":
            return <Gallery key={s.id} s={s} ctx={ctx} first={first} />;
          case "reviews":
            return <Reviews key={s.id} s={s} ctx={ctx} />;
          case "visit":
            return <Visit key={s.id} s={s} ctx={ctx} />;
          case "tour":
            return <Tour key={s.id} s={s} ctx={ctx} />;
          case "journey":
            return <Journey key={s.id} s={s} ctx={ctx} />;
          case "cta":
            return <CtaBand key={s.id} s={s} ctx={ctx} />;
          case "form":
            return <FormSection key={s.id} s={s} ctx={ctx} first={first} />;
          case "newsletter":
            return <Newsletter key={s.id} s={s} ctx={ctx} />;
        }
      })}
    </>
  );
}

/** Used when a page's first section isn't a hero: a plain page title for structure and SEO. */
export function PageTitle({ title }: { title: string }) {
  return (
    <header className={`${wrap} pb-4 pt-32 lg:pt-40`}>
      <h1 className="display text-5xl text-bone sm:text-6xl lg:text-7xl">{title}</h1>
    </header>
  );
}

