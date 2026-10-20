"use client";

import { useEffect, useRef, useState } from "react";

/** Sticky, horizontally scrollable category bar that highlights the category in view. */
export function MenuNav({ categories }: { categories: { id: string; name: string }[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = categories.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.slice(4));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [categories]);

  useEffect(() => {
    // Scroll only the bar horizontally; never move the page.
    const el = bar.current;
    const btn = el?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (el && btn) el.scrollTo({ left: btn.offsetLeft - el.clientWidth / 2 + btn.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label="Menu categories" className="sticky top-[72px] z-[5] -mx-4 border-y border-ink-700 bg-ink-950/95 backdrop-blur-md sm:-mx-6 lg:top-[88px] lg:-mx-10">
      <div ref={bar} className="flex snap-x gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-10">
        {categories.map((c) => (
          <a
            key={c.id}
            href={`#cat-${c.id}`}
            data-cat={c.id}
            aria-current={active === c.id ? "true" : undefined}
            className="shrink-0 snap-start px-4 py-2.5 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-mute transition-colors hover:text-bone aria-[current=true]:bg-ink-800 aria-[current=true]:text-bone"
          >
            {c.name}
          </a>
        ))}
      </div>
    </nav>
  );
}
