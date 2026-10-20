"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { FIELD_TYPES, type FormField } from "@/domain/forms/fields";
import { useGroupError } from "./form";

const TYPE_LABELS: Record<(typeof FIELD_TYPES)[number], string> = {
  text: "Short text",
  email: "Email",
  tel: "Phone",
  textarea: "Long text",
  select: "Dropdown",
  date: "Date",
  time: "Time",
  checkbox: "Tick box (e.g. consent)",
  note: "Note (text only, no input)",
};

/** Edits a form's field list; submitted as JSON in the hidden `fields` input. */
export function FieldsEditor({ initial, submissionsExist }: { initial: FormField[]; submissionsExist: boolean }) {
  const [fields, setFields] = useState<FormField[]>(initial);
  const hidden = useRef<HTMLInputElement>(null);
  const error = useGroupError("fields");
  const original = new Set(initial.map((f) => f.name));

  const touch = () => setTimeout(() => hidden.current?.dispatchEvent(new Event("change", { bubbles: true })));
  const set = (i: number, patch: Partial<FormField>) => {
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    touch();
  };
  const move = (i: number, d: number) => {
    setFields((fs) => {
      const n = [...fs];
      const j = i + d;
      if (j < 0 || j >= n.length) return fs;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    touch();
  };

  return (
    <div className="space-y-3">
      <input ref={hidden} type="hidden" name="fields" value={JSON.stringify(fields)} />
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {fields.map((f, i) => (
        <div key={i} className="rounded-lg border border-[#e6e3de] p-3">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Label</span>
              <input className="admin-input" value={f.label} maxLength={200} onChange={(e) => set(i, { label: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Type</span>
              <select className="admin-input" value={f.type} onChange={(e) => set(i, { type: e.target.value as FormField["type"] })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Field name</span>
              <input
                className="admin-input font-mono text-xs"
                value={f.name}
                maxLength={40}
                onChange={(e) => set(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                readOnly={submissionsExist && original.has(f.name)}
                title={submissionsExist && original.has(f.name) ? "Locked: existing submissions use this name" : undefined}
              />
            </label>
            <div className="flex items-end gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-[#efece7] disabled:opacity-30" aria-label="Move up">
                <ArrowUp size={16} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="rounded p-1.5 hover:bg-[#efece7] disabled:opacity-30" aria-label="Move down">
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFields((fs) => fs.filter((_, j) => j !== i));
                  touch();
                }}
                className="rounded p-1.5 text-[#b42318] hover:bg-red-50"
                aria-label="Remove field"
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
          {f.type !== "note" && (
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Placeholder</span>
                <input className="admin-input" value={f.placeholder} maxLength={120} onChange={(e) => set(i, { placeholder: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Help text</span>
                <input className="admin-input" value={f.help} maxLength={300} onChange={(e) => set(i, { help: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} className="h-4 w-4 accent-[#1c1b19]" />
                Required
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input type="checkbox" checked={f.half} onChange={(e) => set(i, { half: e.target.checked })} className="h-4 w-4 accent-[#1c1b19]" />
                Half width
              </label>
            </div>
          )}
          {f.type === "select" && (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Options (one per line)</span>
              <textarea
                className="admin-input"
                rows={3}
                value={f.options.join("\n")}
                onChange={(e) => set(i, { options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) })}
              />
            </label>
          )}
          {["text", "textarea", "email", "tel"].includes(f.type) && (
            <label className="mt-3 block max-w-[200px] text-sm">
              <span className="mb-1 block font-medium">Max characters</span>
              <input type="number" className="admin-input" min={1} max={5000} value={f.maxLength} onChange={(e) => set(i, { maxLength: Number(e.target.value) || 500 })} />
            </label>
          )}
        </div>
      ))}
      <button
        type="button"
        className="admin-btn admin-btn-secondary"
        onClick={() => {
          setFields((fs) => [
            ...fs,
            { name: `field_${fs.length + 1}`, label: "New field", type: "text", required: false, placeholder: "", help: "", options: [], maxLength: 500, half: false },
          ]);
          touch();
        }}
      >
        <Plus size={14} /> Add field
      </button>
    </div>
  );
}
