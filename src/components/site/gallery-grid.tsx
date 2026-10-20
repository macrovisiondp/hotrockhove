"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, Play, X } from "@phosphor-icons/react";
import type { PublicMedia } from "@/domain/content";

function cld(url: string, t: string) {
  return url.includes("res.cloudinary.com") ? url.replace("/upload/", `/upload/${t}/`) : url;
}

/**
 * Masonry gallery (CSS columns) with a keyboard-accessible lightbox.
 * Videos show their poster until opened, then stream on demand.
 */
export function GalleryGrid({ items }: { items: PublicMedia[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setIndex(null);
    opener.current?.focus();
  }, []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (index === null) return;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, close, step]);

  const current = index === null ? null : items[index];

  return (
    <>
      <ul className="columns-2 gap-3 md:columns-3 md:gap-4 xl:columns-4">
        {items.map((m, i) => {
          const isVideo = m.mimeType.startsWith("video/");
          const thumb = isVideo ? m.posterUrl : m.url;
          const ratio = m.width && m.height ? `${m.width} / ${m.height}` : isVideo ? "9 / 16" : "4 / 5";
          return (
            <li key={m.id} className="mb-3 break-inside-avoid md:mb-4">
              <button
                type="button"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setIndex(i);
                }}
                className="group relative block w-full overflow-hidden bg-ink-900"
                style={{ aspectRatio: ratio }}
                aria-label={`${isVideo ? "Play video" : "View photo"}${m.alt ? `: ${m.alt}` : ` ${i + 1}`}`}
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="absolute inset-0 bg-ink-800" />
                )}
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink-950/20">
                    <span className="inline-flex h-14 w-14 items-center justify-center border border-bone/70 bg-ink-950/40 text-bone backdrop-blur-sm">
                      <Play size={22} weight="fill" />
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {current && (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={current.alt || "Gallery item"}
          tabIndex={-1}
          className="fixed inset-0 z-[50] flex items-center justify-center bg-ink-950/95 outline-none"
          onClick={close}
        >
          <div className="relative flex h-[86dvh] w-[92vw] items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {current.mimeType.startsWith("video/") ? (
              <video
                key={current.id}
                src={cld(current.url, "q_auto,vc_auto,w_1280")}
                poster={current.posterUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full"
              />
            ) : (
              <Image src={current.url} alt={current.alt} fill sizes="92vw" className="object-contain" />
            )}
          </div>
          {current.caption && (
            <p className="absolute bottom-6 left-1/2 max-w-[80vw] -translate-x-1/2 text-center text-sm text-stone">{current.caption}</p>
          )}
          <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 inline-flex h-12 w-12 items-center justify-center text-bone hover:text-bronze">
            <X size={26} />
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous"
                className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center text-bone hover:text-bronze"
              >
                <CaretLeft size={28} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next"
                className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center text-bone hover:text-bronze"
              >
                <CaretRight size={28} />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
