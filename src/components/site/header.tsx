"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { List, X, Phone } from "@phosphor-icons/react";

export type HeaderLink = { id: string; label: string; href: string; external: boolean; isBook: boolean };

/**
 * Desktop: links split evenly either side of a centred logo (grid 1fr auto 1fr,
 * so the logo stays centred whatever the number of links). The "Book Table" link
 * renders as the primary button at the far right.
 * Mobile: centred logo, menu button left, call button right; full-screen menu.
 * The bar turns solid once the page scrolls past a sentinel (IntersectionObserver,
 * no scroll listeners).
 */
export function Header({
  links,
  logoUrl,
  brandName,
  phoneHref,
  overlay,
}: {
  links: HeaderLink[];
  logoUrl: string;
  brandName: string;
  phoneHref: string | null;
  /** Transparent over a full-bleed hero until scrolled. */
  overlay: boolean;
}) {
  const pathname = usePathname();
  const [solid, setSolid] = useState(!overlay);
  const [open, setOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!overlay || !sentinel.current) return;
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting), { rootMargin: "0px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [overlay]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const book = links.find((l) => l.isBook);
  const plain = links.filter((l) => !l.isBook);
  const half = Math.ceil(plain.length / 2);
  const left = plain.slice(0, half);
  const right = plain.slice(half);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  const navLink = (l: HeaderLink) => (
    <li key={l.id}>
      <Link
        href={l.href}
        {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
        aria-current={isActive(l.href) ? "page" : undefined}
        className="link-underline py-2 text-[0.78rem] font-medium uppercase tracking-[0.18em] text-bone/85 transition-colors hover:text-bone aria-[current=page]:text-bone"
      >
        {l.label}
      </Link>
    </li>
  );

  return (
    <>
      <div ref={sentinel} aria-hidden className="absolute top-0 h-24 w-px" />
      <header
        className={`sticky top-0 z-[10] transition-[background-color,border-color,backdrop-filter] duration-500 ${
          solid ? "border-b border-ink-700/70 bg-ink-950/92 backdrop-blur-md" : "border-b border-transparent bg-transparent"
        } ${overlay ? "-mb-[72px] lg:-mb-[88px]" : ""}`}
      >
        <div className="mx-auto grid h-[72px] max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 sm:px-6 lg:h-[88px] lg:px-10">
          {/* Left: desktop links / mobile menu button */}
          <div className="flex items-center">
            <button
              ref={menuButton}
              type="button"
              onClick={() => setOpen(true)}
              className="-ml-2 inline-flex h-11 w-11 items-center justify-center text-bone lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <List size={26} weight="light" />
            </button>
            <nav aria-label="Primary" className="hidden lg:block">
              <ul className="flex items-center gap-8 xl:gap-10">{left.map(navLink)}</ul>
            </nav>
          </div>

          <Link href="/" className="relative block h-[52px] w-[66px] lg:h-[64px] lg:w-[82px]" aria-label={`${brandName} home`}>
            <Image src={logoUrl} alt={brandName} fill priority sizes="82px" className="object-contain" />
          </Link>

          {/* Right: desktop links + book / mobile call */}
          <div className="flex items-center justify-end gap-8 xl:gap-10">
            <nav aria-label="Primary, continued" className="hidden lg:block">
              <ul className="flex items-center gap-8 xl:gap-10">{right.map(navLink)}</ul>
            </nav>
            {book && (
              <Link
                href={book.href}
                {...(book.external ? { target: "_blank", rel: "noopener" } : {})}
                className="btn btn-primary hidden min-h-[44px] px-5 lg:inline-flex"
              >
                {book.label}
              </Link>
            )}
            {phoneHref && (
              <a href={phoneHref} className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-bone lg:hidden" aria-label="Call us">
                <Phone size={22} weight="light" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        className="fixed inset-0 z-[30] flex flex-col bg-ink-950 lg:hidden"
      >
        <div className="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center px-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center text-bone"
            aria-label="Close menu"
            autoFocus
          >
            <X size={26} weight="light" />
          </button>
          <div className="relative h-[52px] w-[66px]">
            <Image src={logoUrl} alt="" fill sizes="66px" className="object-contain" />
          </div>
          <span />
        </div>
        <nav aria-label="Mobile" className="flex flex-1 flex-col justify-center px-8 pb-16">
          <ul className="space-y-1">
            {plain.map((l, i) => (
              <li key={l.id} style={{ animationDelay: `${60 + i * 50}ms` }} className={open ? "animate-rise" : ""}>
                <Link
                  href={l.href}
                  {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="display block py-2 text-[2.4rem] text-bone aria-[current=page]:text-bronze"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {book && (
            <Link
              href={book.href}
              {...(book.external ? { target: "_blank", rel: "noopener" } : {})}
              className="btn btn-primary mt-10 w-full"
            >
              {book.label}
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
