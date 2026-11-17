"use client";

import { useRef, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { MAX_RECIPIENTS, NOTIFY_ALL, formNotifyType, type NotificationRecipient } from "@/domain/notifications";
import { useGroupError } from "./form";

type Row = NotificationRecipient & { id: string };

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Staff notification recipients: each address picks the emails it receives —
 * everything, or particular forms. Submitted as JSON in the hidden `recipients` input.
 */
export function RecipientsEditor({ initial, forms, disabled = false }: { initial: NotificationRecipient[]; forms: { key: string; name: string }[]; disabled?: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, id: newId() })));
  const hidden = useRef<HTMLInputElement>(null);
  const error = useGroupError("recipients");

  const touch = () => setTimeout(() => hidden.current?.dispatchEvent(new Event("change", { bubbles: true })));
  const update = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    touch();
  };
  // Built from the latest state (not this render's copy) so quick successive ticks all count.
  const toggle = (i: number, type: string, on: boolean) => {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        // "All" already includes every form, so individual ticks are dropped when it's chosen.
        if (type === NOTIFY_ALL && on) return { ...r, types: [NOTIFY_ALL] };
        return { ...r, types: on ? [...new Set([...r.types, type])] : r.types.filter((t) => t !== type) };
      }),
    );
    touch();
  };

  const payload = rows.map(({ email, name, types }) => ({ email: email.trim().toLowerCase(), name: name.trim(), types }));

  return (
    <div className="space-y-3">
      <input ref={hidden} type="hidden" name="recipients" value={JSON.stringify(payload)} />
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#d6d3cd] p-4 text-sm text-[#6b665e]">No recipients: staff won&apos;t be emailed about new enquiries (they are still saved under Form submissions).</p>
      )}
      {rows.map((r, i) => {
        const all = r.types.includes(NOTIFY_ALL);
        const id = (k: string) => `rcp-${r.id}-${k}`;
        return (
          <fieldset key={r.id} disabled={disabled} className="rounded-lg border border-[#e6e3de] bg-white p-3">
            <legend className="sr-only">Recipient {i + 1}</legend>
            <div className="grid gap-3 md:grid-cols-[2fr_1.2fr_auto] md:items-end">
              <div>
                <label htmlFor={id("email")} className="mb-1 block text-sm font-medium text-[#3a3733]">
                  Email address
                </label>
                <input id={id("email")} type="email" required className="admin-input" maxLength={254} value={r.email} placeholder="events@hotrockhove.com" onChange={(e) => update(i, { email: e.target.value })} />
              </div>
              <div>
                <label htmlFor={id("name")} className="mb-1 block text-sm font-medium text-[#3a3733]">
                  Label (optional)
                </label>
                <input id={id("name")} className="admin-input" maxLength={80} value={r.name} placeholder="e.g. Events team" onChange={(e) => update(i, { name: e.target.value })} />
              </div>
              <button
                type="button"
                onClick={() => {
                  setRows((rs) => rs.filter((_, j) => j !== i));
                  touch();
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-[#b42318] hover:bg-red-50"
                aria-label={`Remove ${r.email || `recipient ${i + 1}`}`}
              >
                <Trash size={16} /> Remove
              </button>
            </div>
            <p className="mb-1.5 mt-3 text-sm font-medium text-[#3a3733]">Sends this address</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[#1c1b19]" checked={all} onChange={(e) => toggle(i, NOTIFY_ALL, e.target.checked)} />
                All notifications
              </label>
              {forms.map((f) => (
                <label key={f.key} className={`flex items-center gap-2 text-sm ${all ? "text-[#a19b92]" : ""}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#1c1b19]"
                    checked={all || r.types.includes(formNotifyType(f.key))}
                    disabled={all}
                    onChange={(e) => toggle(i, formNotifyType(f.key), e.target.checked)}
                  />
                  {f.name}
                </label>
              ))}
            </div>
            {r.types.length === 0 && <p className="mt-2 text-xs text-[#b42318]">Tick at least one type of email.</p>}
          </fieldset>
        );
      })}
      {!disabled && rows.length < MAX_RECIPIENTS && (
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => {
            setRows((rs) => [...rs, { id: newId(), email: "", name: "", types: [] }]);
            touch();
          }}
        >
          <Plus size={14} /> Add recipient
        </button>
      )}
    </div>
  );
}
