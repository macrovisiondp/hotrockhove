"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import type { FormField } from "@/domain/forms/fields";
import type { PublicFormState } from "@/domain/forms/submit";
import { useConsent } from "./consent";
import { NewsletterForm } from "./newsletter-form";
import { PublicForm } from "./public-form";

export type ClientPopup = {
  id: string;
  version: string;
  template: "image_top" | "image_side" | "text_only";
  heading: string;
  body: string;
  image: { url: string; alt: string } | null;
  cta: { label: string; href: string; external: boolean } | null;
  formKey: string;
  pages: string[];
  trigger: "delay" | "scroll" | "exit_intent";
  delaySeconds: number;
  scrollPercent: number;
  frequency: "session" | "days" | "once";
  frequencyDays: number;
  priority: number;
};

type FormDef = { fields: FormField[]; submitLabel: string };

const KEY = (p: ClientPopup) => `hr_popup_${p.id}_${p.version}`;

function suppressed(p: ClientPopup): boolean {
  try {
    if (p.frequency === "session") return sessionStorage.getItem(KEY(p)) !== null;
    const raw = localStorage.getItem(KEY(p));
    if (!raw) return false;
    if (p.frequency === "once") return true;
    return Date.now() - Number(raw) < p.frequencyDays * 86_400_000;
  } catch {
    return false; // storage blocked: fall back to showing once per page view
  }
}

function remember(p: ClientPopup) {
  try {
    if (p.frequency === "session") sessionStorage.setItem(KEY(p), "1");
    else localStorage.setItem(KEY(p), String(Date.now()));
  } catch {
    /* ignore */
  }
}

function track(id: string, type: "impression" | "dismiss" | "convert") {
  const body = JSON.stringify({ id, type });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/popups/event", new Blob([body], { type: "application/json" }));
  else fetch("/api/popups/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

function matches(p: ClientPopup, path: string) {
  if (p.pages.length === 0) return true;
  return p.pages.some((pg) => (pg === "/" ? path === "/" : path === pg || path.startsWith(pg + "/")));
}

/**
 * Shows at most one pop-up per page view: the highest-priority eligible one.
 * Waits until the visitor has answered the cookie banner so two overlays never stack.
 */
export function PopupHost({
  popups,
  forms,
  submitForm,
  subscribe,
  newsletterConsent,
  turnstileSiteKey,
  privacyHref,
}: {
  popups: ClientPopup[];
  forms: Record<string, FormDef>;
  submitForm: Record<string, (prev: PublicFormState, fd: FormData) => Promise<PublicFormState>>;
  subscribe: (prev: PublicFormState, fd: FormData) => Promise<PublicFormState>;
  newsletterConsent: string;
  turnstileSiteKey: string | null;
  privacyHref: string | null;
}) {
  const path = usePathname();
  const consent = useConsent();
  const [opened, setOpened] = useState<{ popup: ClientPopup; path: string } | null>(null);
  // A pop-up belongs to the page it opened on; navigating away closes it.
  const active = opened && opened.path === path ? opened.popup : null;
  const setActive = useCallback((p: ClientPopup | null) => setOpened(p ? { popup: p, path: window.location.pathname } : null), []);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const candidate =
    consent === null || path.startsWith("/admin")
      ? null
      : ([...popups].sort((a, b) => b.priority - a.priority).find((p) => matches(p, path) && !suppressed(p)) ?? null);

  const open = useCallback(
    (p: ClientPopup) => {
      opener.current = document.activeElement;
      setActive(p);
      remember(p);
      track(p.id, "impression");
    },
    [setActive],
  );

  useEffect(() => {
    if (!candidate || active) return;
    if (candidate.trigger === "delay") {
      const t = setTimeout(() => open(candidate), candidate.delaySeconds * 1000);
      return () => clearTimeout(t);
    }
    if (candidate.trigger === "scroll" && sentinel.current) {
      sentinel.current.style.top = `${candidate.scrollPercent}%`;
      const io = new IntersectionObserver(([e]) => e.isIntersecting && open(candidate));
      io.observe(sentinel.current);
      return () => io.disconnect();
    }
    if (candidate.trigger === "exit_intent") {
      // Desktop only: phones have no pointer leaving the window.
      if (!window.matchMedia("(pointer: fine)").matches) return;
      const onOut = (e: MouseEvent) => {
        if (!e.relatedTarget && e.clientY <= 0) open(candidate);
      };
      const t = setTimeout(() => document.addEventListener("mouseout", onOut), 3000);
      return () => {
        clearTimeout(t);
        document.removeEventListener("mouseout", onOut);
      };
    }
  }, [candidate, active, open]);

  const close = useCallback(
    (converted = false) => {
      if (!active) return;
      track(active.id, converted ? "convert" : "dismiss");
      setActive(null);
      (opener.current as HTMLElement | null)?.focus?.();
    },
    [active, setActive],
  );

  useEffect(() => {
    if (!active) return;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && dialog.current) {
        const els = dialog.current.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])");
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);

  const formDef = active?.formKey && active.formKey !== "newsletter" ? forms[active.formKey] : null;
  const side = active?.template === "image_side" && active.image;

  return (
    <>
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute left-0 h-px w-px" />
      {active && (
        <div className="fixed inset-0 z-[50] flex items-end justify-center bg-ink-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => close()}>
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-heading"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className={`relative max-h-[92dvh] w-full overflow-y-auto border border-ink-600 bg-ink-900 outline-none animate-rise ${
              side ? "max-w-[860px] sm:grid sm:grid-cols-[1fr_1.1fr]" : "max-w-[520px]"
            }`}
          >
            <button
              type="button"
              onClick={() => close()}
              aria-label="Close"
              className="absolute right-2 top-2 z-[1] inline-flex h-11 w-11 items-center justify-center bg-ink-950/60 text-bone hover:text-bronze"
            >
              <X size={22} />
            </button>
            {active.image && active.template !== "text_only" && (
              <div className={`relative ${side ? "min-h-[220px]" : "aspect-[16/9]"}`}>
                <Image src={active.image.url} alt={active.image.alt} fill sizes="(min-width: 640px) 520px, 100vw" className="object-cover" />
              </div>
            )}
            <div className="p-6 sm:p-8">
              <h2 id="popup-heading" className="display text-3xl text-bone sm:text-[2.1rem]">
                {active.heading}
              </h2>
              {active.body && <p className="mt-3 leading-relaxed text-stone">{active.body}</p>}
              <div className="mt-6">
                {active.formKey === "newsletter" ? (
                  <NewsletterForm
                    action={subscribe}
                    consentText={newsletterConsent}
                    turnstileSiteKey={turnstileSiteKey}
                    privacyHref={privacyHref}
                    compact
                    onSuccess={() => track(active.id, "convert")}
                  />
                ) : formDef && submitForm[active.formKey] ? (
                  <PublicForm
                    action={submitForm[active.formKey]}
                    fields={formDef.fields}
                    submitLabel={formDef.submitLabel}
                    turnstileSiteKey={turnstileSiteKey}
                    privacyHref={privacyHref}
                  />
                ) : active.cta ? (
                  <Link
                    href={active.cta.href}
                    {...(active.cta.external ? { target: "_blank", rel: "noopener" } : {})}
                    onClick={() => close(true)}
                    className="btn btn-primary"
                  >
                    {active.cta.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
