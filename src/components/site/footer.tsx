import Image from "next/image";
import Link from "next/link";
import { FacebookLogo, InstagramLogo, TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import type { BusinessSettings } from "@/lib/settings";
import { formatAddress, groupHours, telHref } from "@/lib/settings";
import type { NavLink } from "@/domain/content";

export function Footer({ business, links, logoUrl }: { business: BusinessSettings; links: NavLink[]; logoUrl: string }) {
  const address = formatAddress(business);
  const hours = business.hours.length ? groupHours(business.hours) : [];
  const socials = [
    { href: business.instagramUrl, label: "Instagram", Icon: InstagramLogo },
    { href: business.facebookUrl, label: "Facebook", Icon: FacebookLogo },
    { href: business.tiktokUrl, label: "TikTok", Icon: TiktokLogo },
  ].filter((s) => s.href);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-700 bg-ink-950 pb-28 lg:pb-0">
      <div className="mx-auto grid max-w-[1400px] gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm">
          <div className="relative h-[88px] w-[112px]">
            <Image src={logoUrl} alt={business.name} fill sizes="112px" className="object-contain object-left" />
          </div>
          {business.footerBlurb && <p className="mt-6 text-[0.95rem] leading-relaxed text-stone">{business.footerBlurb}</p>}
          {socials.length > 0 && (
            <ul className="mt-8 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener"
                    aria-label={label}
                    className="inline-flex h-11 w-11 items-center justify-center border border-ink-600 text-stone transition-colors hover:border-bronze hover:text-bone"
                  >
                    <Icon size={20} weight="light" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(address || business.phone || business.email) && (
          <div>
            <h2 className="display text-xl text-bone">Find us</h2>
            <address className="mt-5 space-y-3 text-[0.95rem] not-italic leading-relaxed text-stone">
              {address && (
                <p>
                  {business.mapUrl ? (
                    <a href={business.mapUrl} target="_blank" rel="noopener" className="link-underline hover:text-bone">
                      {address}
                    </a>
                  ) : (
                    address
                  )}
                </p>
              )}
              {business.phone && (
                <p>
                  <a href={telHref(business.phone)} className="link-underline hover:text-bone">
                    {business.phone}
                  </a>
                </p>
              )}
              {business.email && (
                <p>
                  <a href={`mailto:${business.email}`} className="link-underline break-all hover:text-bone">
                    {business.email}
                  </a>
                </p>
              )}
            </address>
          </div>
        )}

        {hours.length > 0 && (
          <div>
            <h2 className="display text-xl text-bone">Opening hours</h2>
            <dl className="mt-5 space-y-3 text-[0.95rem] text-stone">
              {hours.map((h) => (
                <div key={h.label}>
                  <dt className="text-bone/90">{h.label}</dt>
                  <dd>{h.value}</dd>
                </div>
              ))}
            </dl>
            {business.hoursNote && <p className="mt-4 text-sm text-mute">{business.hoursNote}</p>}
          </div>
        )}

        {links.length > 0 && (
          <nav aria-label="Footer">
            <h2 className="display text-xl text-bone">Explore</h2>
            <ul className="mt-5 space-y-3 text-[0.95rem] text-stone">
              {links.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="link-underline hover:text-bone">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="border-t border-ink-800">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-6 text-xs text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>
            © {year} {business.name}. All rights reserved.
          </p>
          <button type="button" data-consent-open className="link-underline self-start text-left hover:text-stone sm:self-auto">
            Cookie preferences
          </button>
        </div>
      </div>
    </footer>
  );
}
