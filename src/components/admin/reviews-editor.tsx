"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeSlash, Plus, Trash } from "@phosphor-icons/react";
import type { Review } from "@/lib/settings";
import { useGroupError } from "./form";

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Edits the list of Google reviews shown on the site. The list is submitted as JSON
 * in a hidden `items` input and validated on the server.
 */
export function ReviewsEditor({ initial }: { initial: Review[] }) {
  const [items, setItems] = useState<Review[]>(initial);
  const hidden = useRef<HTMLInputElement>(null);
  const error = useGroupError("items");

  const touch = () => setTimeout(() => hidden.current?.dispatchEvent(new Event("change", { bubbles: true })));
  const change = (next: Review[]) => {
    setItems(next);
    touch();
  };
  const set = (i: number, patch: Partial<Review>) => change(items.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    change(n);
  };

  return (
    <div className="space-y-3">
      <input ref={hidden} type="hidden" name="items" value={JSON.stringify(items)} />
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {items.map((r, i) => (
        <div key={r.id} className={`rounded-lg border p-3 ${r.hidden ? "border-dashed border-[#c9c4bb] bg-[#faf9f7]" : "border-[#e6e3de] bg-white"}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#8a847b]">Review {i + 1}</span>
            {r.hidden && <span className="text-xs text-[#8a847b]">Hidden</span>}
            <span className="flex-1" />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-[#efece7] disabled:opacity-30" aria-label={`Move review ${i + 1} up`}>
              <ArrowUp size={14} />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded p-1.5 hover:bg-[#efece7] disabled:opacity-30" aria-label={`Move review ${i + 1} down`}>
              <ArrowDown size={14} />
            </button>
            <button type="button" onClick={() => set(i, { hidden: !r.hidden })} className="rounded p-1.5 hover:bg-[#efece7]" aria-label={r.hidden ? `Show review ${i + 1}` : `Hide review ${i + 1}`}>
              {r.hidden ? <EyeSlash size={14} /> : <Eye size={14} />}
            </button>
            <button type="button" onClick={() => change(items.filter((_, j) => j !== i))} className="rounded p-1.5 text-[#b42318] hover:bg-red-50" aria-label={`Remove review ${i + 1}`}>
              <Trash size={14} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#3a3733]">Name (as on Google)</span>
              <input className="admin-input" maxLength={80} value={r.author} onChange={(e) => set(i, { author: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#3a3733]">Stars</span>
              <select className="admin-input" value={r.rating} onChange={(e) => set(i, { rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#3a3733]">Date (optional)</span>
              <input className="admin-input" maxLength={40} placeholder="e.g. February 2026" value={r.date} onChange={(e) => set(i, { date: e.target.value })} />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-[#3a3733]">Review text (copy it exactly)</span>
            <textarea className="admin-input leading-relaxed" rows={3} maxLength={2000} value={r.text} onChange={(e) => set(i, { text: e.target.value })} />
          </label>
        </div>
      ))}
      {items.length === 0 && <p className="rounded-lg border border-dashed border-[#d6d3cd] p-6 text-center text-sm text-[#6b665e]">No reviews yet.</p>}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={() => change([...items, { id: newId(), author: "", rating: 5, text: "", date: "", hidden: false }])}>
        <Plus size={14} /> Add review
      </button>
    </div>
  );
}
