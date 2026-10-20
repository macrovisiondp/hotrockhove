import Link from "next/link";
import { BookOpenText, CalendarCheck, Phone } from "@phosphor-icons/react/dist/ssr";

/**
 * Persistent bottom bar on phones: the three things diners do most.
 * Hidden on desktop, where the header carries the Book Table button.
 */
export function MobileActions({
  phoneHref,
  book,
  bookLabel,
}: {
  phoneHref: string | null;
  book: { href: string; external: boolean };
  bookLabel: string;
}) {
  const item = "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[0.68rem] font-medium uppercase tracking-[0.14em]";
  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-[20] flex border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {phoneHref && (
        <a href={phoneHref} className={`${item} text-stone`}>
          <Phone size={22} weight="light" aria-hidden />
          Call
        </a>
      )}
      <Link href="/our-menus" className={`${item} text-stone`}>
        <BookOpenText size={22} weight="light" aria-hidden />
        Menu
      </Link>
      <Link
        href={book.href}
        {...(book.external ? { target: "_blank", rel: "noopener" } : {})}
        className={`${item} bg-bronze text-ink-950`}
      >
        <CalendarCheck size={22} weight="regular" aria-hidden />
        {bookLabel}
      </Link>
    </nav>
  );
}
