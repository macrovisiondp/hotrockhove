"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PublicFormState } from "@/domain/forms/submit";
import { Honeypot } from "./public-form";
import { submitWithoutReset } from "@/lib/submit";
import { Turnstile } from "./turnstile";

const initial: PublicFormState = { status: "idle", message: "" };

/** Double opt-in newsletter sign-up with an explicit, recorded consent checkbox. */
export function NewsletterForm({
  action,
  consentText,
  turnstileSiteKey,
  privacyHref,
  compact = false,
  onSuccess,
}: {
  action: (prev: PublicFormState, fd: FormData) => Promise<PublicFormState>;
  consentText: string;
  turnstileSiteKey: string | null;
  privacyHref: string | null;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: PublicFormState, fd: FormData) => {
    const next = await action(prev, fd);
    if (next.status === "success") onSuccess?.();
    return next;
  }, initial);

  if (state.status === "success") {
    return (
      <p role="status" className="border-l-2 border-bronze py-2 pl-4 text-bone">
        {state.message}
      </p>
    );
  }
  const id = compact ? "nl-popup" : "nl";
  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction)} noValidate className="relative">
      <Honeypot />
      <label htmlFor={`${id}-email`} className="mb-2 block text-sm font-medium text-bone">
        Email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field-input sm:flex-1"
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.status === "error" ? `${id}-err` : undefined}
        />
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "Sending…" : "Subscribe"}
        </button>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone">
        <input name="consent" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-bronze)]" />
        <span>
          {consentText}{" "}
          {privacyHref && (
            <Link href={privacyHref} className="text-bone underline underline-offset-4">
              Privacy policy
            </Link>
          )}
        </span>
      </label>
      {turnstileSiteKey && (
        <div className="mt-4">
          <Turnstile siteKey={turnstileSiteKey} resetKey={state.at} />
        </div>
      )}
      {state.status === "error" && (
        <p id={`${id}-err`} role="alert" className="mt-3 text-sm text-[#f0a397]">
          {state.message}
        </p>
      )}
    </form>
  );
}
