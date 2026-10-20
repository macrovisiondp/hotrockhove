"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import type { FormField } from "@/domain/forms/fields";
import type { PublicFormState } from "@/domain/forms/submit";
import { submitWithoutReset } from "@/lib/submit";
import { Turnstile } from "./turnstile";

const initial: PublicFormState = { status: "idle", message: "" };

/** Hidden field that only bots fill in. Name must match HONEYPOT_FIELD on the server. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function PublicForm({
  action,
  fields,
  submitLabel,
  turnstileSiteKey,
  privacyHref,
}: {
  action: (prev: PublicFormState, fd: FormData) => Promise<PublicFormState>;
  fields: FormField[];
  submitLabel: string;
  turnstileSiteKey: string | null;
  privacyHref: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const status = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "idle") status.current?.focus();
  }, [state.at, state.status]);

  if (state.status === "success") {
    return (
      <div ref={status} tabIndex={-1} role="status" className="border border-bronze/50 bg-ink-900 p-8 outline-none">
        <CheckCircle size={32} weight="light" className="text-bronze" aria-hidden />
        <p className="mt-4 text-lg leading-relaxed text-bone">{state.message}</p>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};
  const val = state.values ?? {};

  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction)} noValidate className="relative">
      <Honeypot />
      {state.status === "error" && (
        <div ref={status} tabIndex={-1} role="alert" className="mb-6 border-l-2 border-ember bg-ink-900 px-4 py-3 text-sm text-bone outline-none">
          {state.message}
        </div>
      )}
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `f-${f.name}`;
          const describedBy = [f.help ? `${id}-help` : "", err[f.name] ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
          const span = f.half ? "" : "sm:col-span-2";

          if (f.type === "note") {
            return (
              <p key={f.name} className={`text-sm text-stone ${span}`}>
                {f.label}
              </p>
            );
          }

          if (f.type === "checkbox") {
            return (
              <div key={f.name} className={span}>
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone">
                  <input
                    id={id}
                    name={f.name}
                    type="checkbox"
                    defaultChecked={val[f.name] === "on"}
                    aria-invalid={err[f.name] ? true : undefined}
                    aria-describedby={describedBy}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-bronze)]"
                  />
                  <span>
                    {f.label}
                    {f.required && <span className="text-bronze"> *</span>}
                  </span>
                </label>
                {err[f.name] && (
                  <p id={`${id}-err`} className="mt-2 text-sm text-[#f0a397]">
                    {err[f.name]}
                  </p>
                )}
              </div>
            );
          }

          const common = {
            id,
            name: f.name,
            required: f.required,
            defaultValue: val[f.name] ?? "",
            "aria-invalid": err[f.name] ? true : undefined,
            "aria-describedby": describedBy,
            className: "field-input",
          };
          return (
            <div key={f.name} className={`flex flex-col gap-2 ${span}`}>
              <label htmlFor={id} className="text-sm font-medium text-bone">
                {f.label}
                {f.required ? <span className="text-bronze"> *</span> : <span className="font-normal text-mute"> (optional)</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea {...common} rows={5} maxLength={f.maxLength} placeholder={f.placeholder || undefined} />
              ) : f.type === "select" ? (
                <select {...common}>
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  type={f.type}
                  maxLength={f.type === "date" || f.type === "time" ? undefined : f.maxLength}
                  placeholder={f.placeholder || undefined}
                  autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.name.includes("name") ? "name" : undefined}
                  min={f.type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
                />
              )}
              {f.help && (
                <p id={`${id}-help`} className="text-sm text-mute">
                  {f.help}
                </p>
              )}
              {err[f.name] && (
                <p id={`${id}-err`} className="text-sm text-[#f0a397]">
                  {err[f.name]}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {turnstileSiteKey && (
        <div className="mt-6">
          <Turnstile siteKey={turnstileSiteKey} resetKey={state.at} />
        </div>
      )}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "Sending…" : submitLabel}
        </button>
        {privacyHref && (
          <p className="text-xs text-mute">
            We use your details only to respond. See our{" "}
            <Link href={privacyHref} className="text-stone underline underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        )}
      </div>
    </form>
  );
}
