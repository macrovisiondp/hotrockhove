"use client";

import { useEffect, useRef } from "react";

/**
 * Muted, looping background video for the hero. Respects reduced motion (poster
 * only) and Save-Data, and pauses when scrolled out of view to save bandwidth.
 */
export function HeroVideo({ src, poster, type }: { src: string; poster: string | null; type: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) return;
    v.src = src;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.1 });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={poster ?? undefined}
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
      data-type={type}
    />
  );
}
