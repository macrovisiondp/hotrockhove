"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Cookie consent (UK GDPR / PECR). Essential cookies only by default; optional
 * third-party content (Google reviews widget, analytics) loads only after the
 * visitor chooses "Accept all". The choice is stored in a first-party cookie for
 * 180 days and can be changed from the footer ("Cookie preferences").
 */
export type ConsentChoice = "all" | "essential" | null;
const COOKIE = "hr_consent";
const EVENT = "hr-consent-change";

function read(): ConsentChoice {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )hr_consent=(all|essential)/);
  return (m?.[1] as ConsentChoice) ?? null;
}

function write(choice: Exclude<ConsentChoice, null>) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${choice}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useConsent(): ConsentChoice {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function ConsentBanner({ text, policyHref }: { text: string; policyHref: string | null }) {
  const choice = useConsent();
  const [forcedOpen, setForcedOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-consent-open]")) setForcedOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (forcedOpen) acceptRef.current?.focus();
  }, [forcedOpen]);

  if (!mounted || (choice && !forcedOpen)) return null;

  const decide = (c: "all" | "essential") => {
    write(c);
    setForcedOpen(false);
  };

  return (
    <section
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-[76px] z-[40] mx-auto max-w-[560px] border border-ink-600 bg-ink-900 p-5 shadow-[0_24px_60px_rgb(0_0_0/0.5)] sm:inset-x-6 lg:bottom-6 lg:left-6 lg:right-auto"
    >
      <p className="text-sm leading-relaxed text-stone">
        {text}{" "}
        {policyHref && (
          <Link href={policyHref} className="text-bone underline underline-offset-4">
            Privacy policy
          </Link>
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button ref={acceptRef} type="button" onClick={() => decide("all")} className="btn btn-primary min-h-[44px] flex-1 px-4">
          Accept all
        </button>
        <button type="button" onClick={() => decide("essential")} className="btn btn-ghost min-h-[44px] flex-1 px-4">
          Essential only
        </button>
      </div>
    </section>
  );
}

/** Loads an analytics script only after consent. GA4 and Plausible are supported. */
export function Analytics({ provider, id, domain }: { provider: "none" | "ga4" | "plausible"; id: string; domain: string }) {
  const choice = useConsent();
  useEffect(() => {
    if (choice !== "all" || provider === "none" || !id) return;
    if (document.querySelector("script[data-hr-analytics]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.dataset.hrAnalytics = provider;
    if (provider === "ga4") {
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", id, { anonymize_ip: true });
    } else {
      s.src = "https://plausible.io/js/script.js";
      s.dataset.domain = domain;
    }
    document.head.appendChild(s);
  }, [choice, provider, id, domain]);
  return null;
}
