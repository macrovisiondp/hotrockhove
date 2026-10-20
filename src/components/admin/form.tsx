"use client";

import Link from "next/link";
import { createContext, useActionState, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { submitWithoutReset } from "@/lib/submit";

export type ActionState = { ok: boolean; message: string; fieldErrors?: Record<string, string>; at?: number };
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const ErrorsContext = createContext<Record<string, string>>({});
export const useFieldError = (name: string) => useContext(ErrorsContext)[name];
/** First error whose key is `prefix` or starts with `prefix.` (for grouped inputs). */
export const useGroupError = (prefix: string) => {
  const all = useContext(ErrorsContext);
  const key = Object.keys(all).find((k) => k === prefix || k.startsWith(prefix + "."));
  return key ? all[key] : undefined;
};

/**
 * Admin form wrapper: posts to a server action, shows a success/failure banner,
 * exposes field errors to the inputs inside it, and offers Save + Cancel.
 * "Cancel" resets unsaved edits (or follows `cancelHref`).
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save changes",
  cancelHref,
  showCancel = true,
  className = "",
  resetOnSuccess = false,
  disabled = false,
  compact = false,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  cancelHref?: string;
  showCancel?: boolean;
  className?: string;
  resetOnSuccess?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  const form = useRef<HTMLFormElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  // Edits made after the last successful save count as unsaved.
  const [editedAt, setEditedAt] = useState<number | null>(null);
  const [cancelledAt, setCancelledAt] = useState(0);
  // Marks the form as interactive (used by end-to-end tests to avoid clicking before hydration).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dirty = editedAt !== null && editedAt > cancelledAt && !(state.ok && state.at && state.at > editedAt);

  useEffect(() => {
    if (!state.at) return;
    if (state.ok && resetOnSuccess) form.current?.reset();
    banner.current?.focus();
  }, [state.at, state.ok, resetOnSuccess]);

  return (
    <ErrorsContext.Provider value={state.fieldErrors ?? {}}>
      <form ref={form} action={formAction} onSubmit={submitWithoutReset(formAction)} onChange={() => setEditedAt(Date.now())} className={className} noValidate data-hydrated={hydrated || undefined}>
        {state.message && (
          <div
            ref={banner}
            tabIndex={-1}
            role={state.ok ? "status" : "alert"}
            className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm outline-none ${
              state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {state.ok ? <CheckCircle size={18} className="mt-px shrink-0" /> : <WarningCircle size={18} className="mt-px shrink-0" />}
            <span>{state.message}</span>
          </div>
        )}
        <fieldset disabled={disabled || pending} className="min-w-0 space-y-4 disabled:opacity-80">
          {children}
        </fieldset>
        {!disabled && (
          <div className={`flex items-center gap-2 ${compact ? "mt-3" : "mt-6 border-t border-[#ece9e4] pt-4"}`}>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </button>
            {showCancel &&
              (cancelHref ? (
                <Link href={cancelHref} className="admin-btn admin-btn-secondary">
                  Cancel
                </Link>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  disabled={!dirty || pending}
                  onClick={() => {
                    form.current?.reset();
                    setCancelledAt(Date.now());
                  }}
                >
                  Cancel
                </button>
              ))}
            {dirty && !pending && <span className="text-xs text-[#8a847b]">Unsaved changes</span>}
          </div>
        )}
      </form>
    </ErrorsContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */

export function Field({
  label,
  name,
  hint,
  children,
  className = "",
}: {
  label: string;
  name: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const error = useFieldError(name);
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={`fld-${name}`} className="block text-sm font-medium text-[#3a3733]">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#78736b]">{hint}</p>}
      {error && (
        <p id={`fld-${name}-err`} className="text-xs font-medium text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: ReactNode; wrapClass?: string };

export function TextInput({ name, label, hint, wrapClass, ...rest }: InputProps) {
  const error = useFieldError(name);
  return (
    <Field label={label} name={name} hint={hint} className={wrapClass}>
      <input
        id={`fld-${name}`}
        name={name}
        className="admin-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `fld-${name}-err` : undefined}
        {...rest}
      />
    </Field>
  );
}

export function TextArea({
  name,
  label,
  hint,
  wrapClass,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; label: string; hint?: ReactNode; wrapClass?: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} name={name} hint={hint} className={wrapClass}>
      <textarea
        id={`fld-${name}`}
        name={name}
        rows={4}
        className="admin-input leading-relaxed"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `fld-${name}-err` : undefined}
        {...rest}
      />
    </Field>
  );
}

export function Select({
  name,
  label,
  hint,
  options,
  wrapClass,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
  wrapClass?: string;
}) {
  const error = useFieldError(name);
  return (
    <Field label={label} name={name} hint={hint} className={wrapClass}>
      <select id={`fld-${name}`} name={name} className="admin-input" aria-invalid={error ? true : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: ReactNode; defaultChecked?: boolean }) {
  const error = useFieldError(name);
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[#3a3733]">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-[#1c1b19]" />
        <span>
          <span className="font-medium">{label}</span>
          {hint && <span className="block text-xs text-[#78736b]">{hint}</span>}
        </span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-[#b42318]">{error}</p>}
    </div>
  );
}

/** Two-step inline confirmation for destructive actions (no browser dialogs). */
export function ConfirmButton({
  action,
  label,
  confirmLabel = "Yes, delete",
  question = "Are you sure? This can't be undone.",
  hidden = {},
  className = "admin-btn admin-btn-danger",
}: {
  action: Action;
  label: string;
  confirmLabel?: string;
  question?: string;
  hidden?: Record<string, string>;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  if (!asking)
    return (
      <span className="inline-flex flex-col gap-1">
        <button type="button" className={className} onClick={() => setAsking(true)}>
          {label}
        </button>
        {state.message && !state.ok && <span className="text-xs text-[#b42318]">{state.message}</span>}
      </span>
    );
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="text-xs text-red-900">{question}</span>
      <button type="submit" className="admin-btn admin-btn-danger min-h-[30px]" disabled={pending}>
        {pending ? "Working…" : confirmLabel}
      </button>
      <button type="button" className="admin-btn admin-btn-secondary min-h-[30px]" onClick={() => setAsking(false)}>
        Keep
      </button>
    </form>
  );
}

/** Small form with a single button (status changes, publish, reorder). */
export function InlineAction({
  action,
  hidden,
  label,
  className = "admin-btn admin-btn-secondary",
  title,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: ReactNode;
  className?: string;
  title?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
  return (
    <form action={formAction} className="inline">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pending} title={title ?? (state.message || undefined)} aria-label={title}>
        {label}
      </button>
      {state.message && !state.ok && <span className="ml-2 text-xs text-[#b42318]">{state.message}</span>}
    </form>
  );
}
