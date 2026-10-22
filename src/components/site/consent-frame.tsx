"use client";

import { useState } from "react";
import { useConsent } from "./consent";

/**
 * Third-party iframe (Google Maps, the 360° tour) that may set its own cookies.
 * Loads straight away for visitors who accepted optional cookies; everyone else
 * sees a placeholder and loads it with one click (an explicit, per-view choice).
 */
export function ConsentFrame({
  src,
  title,
  loadLabel,
  notice,
  allow,
  className = "",
}: {
  src: string;
  title: string;
  loadLabel: string;
  notice: string;
  allow?: string;
  className?: string;
}) {
  const choice = useConsent();
  const [clicked, setClicked] = useState(false);

  if (choice === "all" || clicked) {
    return (
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allow={allow}
        allowFullScreen
        className={`h-full w-full border-0 ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-900 p-8 text-center ${className}`}>
      <p className="max-w-[42ch] text-sm leading-relaxed text-stone">{notice}</p>
      <button type="button" onClick={() => setClicked(true)} className="btn btn-ghost">
        {loadLabel}
      </button>
    </div>
  );
}
