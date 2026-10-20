"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "./consent";

/**
 * Trustindex Google-reviews widget. Third-party content, so it is injected only
 * after the visitor accepts optional cookies; until then a short notice is shown.
 * Reviews are never typed in by hand.
 */
export function ReviewsEmbed({ src }: { src: string }) {
  const choice = useConsent();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (choice !== "all" || !box.current || box.current.querySelector("script")) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    box.current.appendChild(s);
  }, [choice, src]);

  if (choice !== "all") {
    return (
      <div className="border border-ink-700 p-8 text-center text-sm text-stone">
        Our Google reviews are shown using a third-party widget.{" "}
        <button type="button" data-consent-open className="text-bone underline underline-offset-4">
          Allow optional cookies
        </button>{" "}
        to view them.
      </div>
    );
  }
  return <div ref={box} className="min-h-[200px]" />;
}
