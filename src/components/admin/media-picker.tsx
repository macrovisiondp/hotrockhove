"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImageSquare, Play, X } from "@phosphor-icons/react";

export type PickerItem = {
  id: string;
  url: string;
  posterUrl: string | null;
  filename: string;
  alt: string;
  mimeType: string;
  rightsStatus: string;
};

async function search(q: string, type: string | undefined, ids?: string[]): Promise<PickerItem[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  if (ids?.length) params.set("ids", ids.join(","));
  const res = await fetch(`/api/admin/media?${params}`, { cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as { items: PickerItem[] }).items;
}

function Thumb({ item, size = 64 }: { item: PickerItem; size?: number }) {
  const isVideo = item.mimeType.startsWith("video/");
  const src = isVideo ? item.posterUrl : item.url;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded bg-[#e9e6e1]" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnails; next/image would optimise every picker result
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : isVideo ? (
        <Play size={20} className="text-[#6b665e]" />
      ) : (
        <ImageSquare size={20} className="text-[#6b665e]" />
      )}
      {isVideo && src && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white">
          <Play size={10} weight="fill" />
        </span>
      )}
    </span>
  );
}

function PickerDialog({
  type,
  multiple,
  onClose,
  onPick,
}: {
  type?: "image" | "video";
  multiple: boolean;
  onClose: () => void;
  onPick: (items: PickerItem[]) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickerItem[] | null>(null);
  const [selected, setSelected] = useState<PickerItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => search(q, type).then(setItems), q ? 250 : 0);
    return () => clearTimeout(id);
  }, [q, type]);

  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (it: PickerItem) => {
    if (!multiple) return onPick([it]);
    setSelected((s) => (s.some((x) => x.id === it.id) ? s.filter((x) => x.id !== it.id) : [...s, it]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Choose media"
        className="admin flex max-h-[85dvh] w-full max-w-3xl flex-col rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#e6e3de] p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name or description" className="admin-input flex-1" aria-label="Search media" />
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {items === null ? (
            <p className="p-6 text-center text-sm text-[#6b665e]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#6b665e]">Nothing found. Upload files in Media first.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.map((it) => {
                const on = selected.some((s) => s.id === it.id);
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => toggle(it)}
                      aria-pressed={multiple ? on : undefined}
                      className={`block w-full rounded-md border p-1 text-left ${on ? "border-[#1c1b19] ring-2 ring-[#1c1b19]" : "border-transparent hover:border-[#c9c4bb]"}`}
                    >
                      <span className="block aspect-square w-full overflow-hidden rounded">
                        <Thumb item={it} size={140} />
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-[#6b665e]">{it.alt || it.filename}</span>
                      {it.rightsStatus !== "cleared" && <span className="block text-[10px] font-medium text-amber-700">Rights {it.rightsStatus}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {multiple && (
          <div className="flex items-center justify-between border-t border-[#e6e3de] p-3">
            <span className="text-sm text-[#6b665e]">{selected.length} selected</span>
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => onPick(selected)} disabled={!selected.length}>
              Add selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Single media field: stores the chosen id in a hidden input named `name`. */
export function MediaField({ name, label, defaultId, type, hint }: { name: string; label: string; defaultId?: string | null; type?: "image" | "video"; hint?: string }) {
  const [item, setItem] = useState<PickerItem | null>(null);
  const [id, setId] = useState(defaultId ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (defaultId) search("", undefined, [defaultId]).then((r) => setItem(r[0] ?? null));
  }, [defaultId]);

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-[#3a3733]">{label}</span>
      <input type="hidden" name={name} value={id} />
      <div className="flex items-center gap-3">
        {item ? <Thumb item={item} /> : <span className="inline-flex h-16 w-16 items-center justify-center rounded border border-dashed border-[#c9c4bb] text-xs text-[#8a847b]">None</span>}
        <div className="min-w-0">
          {item && <p className="truncate text-xs text-[#6b665e]">{item.alt || item.filename}</p>}
          <div className="mt-1 flex gap-2">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>
              {item ? "Change" : "Choose"}
            </button>
            {item && (
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => {
                  setItem(null);
                  setId("");
                  // Let the surrounding form know it changed.
                  setTimeout(() => document.querySelector(`input[name="${name}"]`)?.dispatchEvent(new Event("change", { bubbles: true })));
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {hint && <p className="text-xs text-[#78736b]">{hint}</p>}
      {open && (
        <PickerDialog
          type={type}
          multiple={false}
          onClose={() => setOpen(false)}
          onPick={([it]) => {
            setItem(it);
            setId(it.id);
            setOpen(false);
            setTimeout(() => document.querySelector(`input[name="${name}"]`)?.dispatchEvent(new Event("change", { bubbles: true })));
          }}
        />
      )}
    </div>
  );
}

/** Ordered list of media (galleries). Stores a comma-separated id list in `name`. */
export function MediaListField({ name, label, defaultIds }: { name: string; label: string; defaultIds: string[] }) {
  const [items, setItems] = useState<PickerItem[]>([]);
  const [open, setOpen] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!defaultIds.length) return;
    search("", undefined, defaultIds).then((r) => {
      const byId = new Map(r.map((x) => [x.id, x]));
      setItems(defaultIds.map((id) => byId.get(id)).filter(Boolean) as PickerItem[]);
    });
  }, [defaultIds]);

  const changed = useCallback(() => setTimeout(() => hidden.current?.dispatchEvent(new Event("change", { bubbles: true }))), []);
  const move = (i: number, d: number) => {
    setItems((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    changed();
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[#3a3733]">
        {label} <span className="font-normal text-[#8a847b]">({items.length})</span>
      </span>
      <input ref={hidden} type="hidden" name={name} value={items.map((i) => i.id).join(",")} />
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((it, i) => (
            <li key={it.id} className="rounded border border-[#e6e3de] p-1">
              <span className="block aspect-square overflow-hidden rounded">
                <Thumb item={it} size={120} />
              </span>
              <div className="mt-1 flex justify-between">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="rounded p-1 hover:bg-[#efece7] disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move later" className="rounded p-1 hover:bg-[#efece7] disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItems((l) => l.filter((x) => x.id !== it.id));
                    changed();
                  }}
                  aria-label="Remove"
                  className="rounded p-1 text-[#b42318] hover:bg-red-50"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>
        Add media
      </button>
      {open && (
        <PickerDialog
          multiple
          onClose={() => setOpen(false)}
          onPick={(picked) => {
            setItems((l) => [...l, ...picked.filter((p) => !l.some((x) => x.id === p.id))]);
            setOpen(false);
            changed();
          }}
        />
      )}
    </div>
  );
}
