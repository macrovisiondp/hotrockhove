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
  backdrop,
}: {
  src: string;
  title: string;
  loadLabel: string;
  notice: string;
  allow?: string;
  className?: string;
  /** Optional preview (e.g. an image) shown behind the placeholder. */
  backdrop?: React.ReactNode;
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
    <div className={`isolate flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-900 p-8 text-center ${className}`}>
      {backdrop && (
        <div className="absolute inset-0 -z-10" aria-hidden>
          {backdrop}
          <div className="absolute inset-0 bg-ink-950/55" />
        </div>
      )}
      <button type="button" onClick={() => setClicked(true)} className={`btn ${backdrop ? "btn-primary" : "btn-ghost"}`}>
        {loadLabel}
      </button>
      <p className={`max-w-[42ch] text-sm leading-relaxed ${backdrop ? "text-bone/85" : "text-stone"}`}>{notice}</p>
    </div>
  );
}
