"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, Star } from "@phosphor-icons/react";
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
    <article className="flex h-full flex-col border border-ink-800 bg-ink-900/60 p-6 lg:p-7">
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

const AUTOPLAY_MS = 6000;

/**
 * One row of review cards that slides: 1 card on phones, 2 on tablets, 3 on desktop.
 * Arrows and swipe move it; it advances by itself every few seconds (looping back to
 * the start), pausing while the visitor hovers, focuses or touches it, and never
 * for visitors who prefer reduced motion.
 */
export function ReviewsList({ items }: { items: Review[] }) {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-review]");
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const width = card ? card.offsetWidth + gap : el.clientWidth;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: dir * width, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reduce
      ? undefined
      : window.setInterval(() => {
          if (!paused.current && !document.hidden) step(1);
        }, AUTOPLAY_MS);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (timer) window.clearInterval(timer);
    };
  }, [step, update]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Google reviews"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      onTouchStart={() => (paused.current = true)}
    >
      <div
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-stretch gap-4 overflow-x-auto px-4 pb-2 sm:scroll-px-0 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:gap-5 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((r, i) => (
          <div
            key={r.id}
            data-review
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}`}
            className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
          >
            <ReviewCard r={r} />
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label="Previous reviews"
            className="inline-flex h-11 w-11 items-center justify-center border border-ink-600 text-bone transition-colors hover:border-bronze hover:text-bronze disabled:opacity-30"
          >
            <CaretLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next reviews"
            className="inline-flex h-11 w-11 items-center justify-center border border-ink-600 text-bone transition-colors hover:border-bronze hover:text-bronze"
          >
            <CaretRight size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
