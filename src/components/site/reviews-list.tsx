"use client";

import { useState } from "react";
import { Star } from "@phosphor-icons/react";
import type { Review } from "@/lib/settings";

export function Stars({ rating, size = 16, label = true }: { rating: number; size?: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#f5b301]" role={label ? "img" : undefined} aria-label={label ? `${rating} out of 5 stars` : undefined} aria-hidden={!label}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} weight={i < rating ? "fill" : "regular"} aria-hidden />
      ))}
    </span>
  );
}

/** Google "G" mark, drawn inline (no third-party request). */
export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  const long = r.text.length > 220;
  return (
    <article className="flex h-full flex-col border border-ink-800 bg-ink-900/60 p-6 sm:h-auto lg:p-7">
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bronze/20 font-semibold text-bronze">
          {r.author.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-bone">{r.author}</p>
          {r.date && <p className="text-xs text-mute">{r.date}</p>}
        </div>
        <span title="Posted on Google">
          <GoogleG />
        </span>
      </div>
      <div className="mt-4">
        <Stars rating={r.rating} />
      </div>
      <p className={`mt-3 flex-1 leading-relaxed text-stone ${long && !open ? "line-clamp-5" : ""}`}>{r.text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-3 self-start text-sm text-bone underline underline-offset-4" aria-expanded={open}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </article>
  );
}

/** Review cards: a swipeable row on phones, a grid from tablets up. */
export function ReviewsList({ items }: { items: Review[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:items-start sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:gap-5">
      {items.map((r) => (
        <div key={r.id} className="w-[85%] shrink-0 snap-start sm:w-auto">
          <ReviewCard r={r} />
        </div>
      ))}
    </div>
  );
}
