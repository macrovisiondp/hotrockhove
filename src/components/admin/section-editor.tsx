"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeSlash, Plus, Trash } from "@phosphor-icons/react";
import { blankSection, SECTION_LABELS, SECTION_TYPES, type Section, type SectionType } from "@/domain/sections";
import { useGroupError } from "./form";
import { MediaField, MediaListField } from "./media-picker";

type FieldDef =
  | { key: string; label: string; kind: "text"; max: number; hint?: string }
  | { key: string; label: string; kind: "textarea"; max: number; rows?: number; hint?: string }
  | { key: string; label: string; kind: "media"; type?: "image" | "video"; hint?: string }
  | { key: string; label: string; kind: "mediaList" }
  | { key: string; label: string; kind: "cta" }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "checkbox"; hint?: string }
  | { key: string; label: string; kind: "number"; min: number; max: number; hint?: string }
  | { key: string; label: string; kind: "form" };

const BODY_HINT = "Blank line = new paragraph. **bold**, *italic*.";

const FIELDS: Record<SectionType, FieldDef[]> = {
  hero: [
    { key: "eyebrow", label: "Small label above the heading", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Intro (max ~20 words works best)", kind: "textarea", max: 400, rows: 2 },
    { key: "mediaId", label: "Background image", kind: "media", type: "image" },
    { key: "videoId", label: "Background video (optional, muted loop)", kind: "media", type: "video", hint: "Plays only for visitors without reduced-motion or data-saver settings." },
    { key: "primaryCta", label: "Main button", kind: "cta" },
    { key: "secondaryCta", label: "Second button", kind: "cta" },
  ],
  story: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Text", kind: "textarea", max: 6000, rows: 10, hint: BODY_HINT },
    { key: "signature", label: "Signature (optional)", kind: "text", max: 80 },
    { key: "signatureRole", label: "Signature role", kind: "text", max: 120 },
    { key: "mediaId", label: "Image", kind: "media", type: "image" },
    { key: "imageSide", label: "Image side", kind: "select", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] },
    { key: "cta", label: "Button", kind: "cta" },
  ],
  text: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Text", kind: "textarea", max: 20000, rows: 12, hint: BODY_HINT },
    { key: "align", label: "Alignment", kind: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Centred" }] },
  ],
  quote: [
    { key: "quote", label: "Quote", kind: "textarea", max: 300, rows: 2 },
    { key: "attribution", label: "Attribution", kind: "text", max: 120 },
  ],
  video: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Caption", kind: "textarea", max: 1000, rows: 4, hint: BODY_HINT },
    { key: "videoId", label: "Video", kind: "media", type: "video" },
    { key: "mediaId", label: "Poster image (optional)", kind: "media", type: "image", hint: "Cloudinary creates one automatically if left empty." },
  ],
  menuHighlights: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Intro", kind: "textarea", max: 400, rows: 2 },
    { key: "cta", label: "Button", kind: "cta" },
  ],
  menu: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Intro", kind: "textarea", max: 1000, rows: 3 },
  ],
  offers: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Intro", kind: "textarea", max: 1000, rows: 3 },
  ],
  gallery: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "mediaIds", label: "Photos and videos", kind: "mediaList" },
    { key: "limit", label: "Show at most (0 = all)", kind: "number", min: 0, max: 200, hint: "Use a small number with a button for a preview." },
    { key: "cta", label: "Button (shown when limited)", kind: "cta" },
  ],
  reviews: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
  ],
  visit: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Intro", kind: "textarea", max: 400, rows: 2 },
    { key: "mediaId", label: "Image", kind: "media", type: "image" },
  ],
  cta: [
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Text", kind: "textarea", max: 400, rows: 2 },
    { key: "mediaId", label: "Background image", kind: "media", type: "image" },
    { key: "primaryCta", label: "Main button", kind: "cta" },
    { key: "secondaryCta", label: "Second button", kind: "cta" },
  ],
  form: [
    { key: "eyebrow", label: "Small label", kind: "text", max: 80 },
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Intro", kind: "textarea", max: 1000, rows: 3 },
    { key: "formKey", label: "Form", kind: "form" },
    { key: "showContact", label: "Show contact details and hours beside the form", kind: "checkbox" },
  ],
  newsletter: [
    { key: "heading", label: "Heading", kind: "text", max: 140 },
    { key: "body", label: "Text", kind: "textarea", max: 400, rows: 2 },
  ],
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

type Rec = Record<string, unknown>;

/**
 * Edits an ordered list of typed sections. The whole list is submitted as JSON in
 * a hidden `sections` input and validated on the server against the same schemas.
 */
export function SectionEditor({ initial, forms }: { initial: Section[]; forms: { key: string; name: string }[] }) {
  const [sections, setSections] = useState<Rec[]>(initial as unknown as Rec[]);
  const [adding, setAdding] = useState<SectionType>("text");
  const [open, setOpen] = useState<string | null>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const error = useGroupError("sections");

  const touch = () => setTimeout(() => hidden.current?.dispatchEvent(new Event("change", { bubbles: true })));
  const update = (i: number, patch: Rec) => {
    setSections((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    touch();
  };
  const move = (i: number, d: number) => {
    setSections((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    touch();
  };

  return (
    <div className="space-y-3">
      <input ref={hidden} type="hidden" name="sections" value={JSON.stringify(sections)} />
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {sections.map((s, i) => {
        const type = s.type as SectionType;
        const id = String(s.id);
        const isOpen = open === id;
        const title = String(s.heading || s.quote || "") || "(no heading)";
        return (
          <div key={id} className={`rounded-lg border ${s.hidden ? "border-dashed border-[#c9c4bb] bg-[#faf9f7]" : "border-[#e6e3de] bg-white"}`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => setOpen(isOpen ? null : id)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#8a847b]">{SECTION_LABELS[type]?.label ?? type}</span>
                <span className="block truncate text-sm font-medium">{title}</span>
              </button>
              {Boolean(s.hidden) && <span className="text-xs text-[#8a847b]">Hidden</span>}
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-[#efece7] disabled:opacity-30" aria-label="Move up">
                <ArrowUp size={16} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="rounded p-1.5 hover:bg-[#efece7] disabled:opacity-30" aria-label="Move down">
                <ArrowDown size={16} />
              </button>
              <button type="button" onClick={() => update(i, { hidden: !s.hidden })} className="rounded p-1.5 hover:bg-[#efece7]" aria-label={s.hidden ? "Show section" : "Hide section"}>
                {s.hidden ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSections((x) => x.filter((_, j) => j !== i));
                  touch();
                }}
                className="rounded p-1.5 text-[#b42318] hover:bg-red-50"
                aria-label="Remove section"
              >
                <Trash size={16} />
              </button>
            </div>
            {isOpen && (
              <div className="space-y-4 border-t border-[#f0ede8] p-4">
                {SECTION_LABELS[type] && <p className="text-xs text-[#78736b]">{SECTION_LABELS[type].hint}</p>}
                {(FIELDS[type] ?? []).map((f) => (
                  <FieldInput key={f.key} def={f} sectionId={id} value={s[f.key]} forms={forms} onChange={(v) => update(i, { [f.key]: v })} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {sections.length === 0 && <p className="rounded-lg border border-dashed border-[#d6d3cd] p-6 text-center text-sm text-[#6b665e]">This page has no sections yet.</p>}
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f3f1ed] p-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Add a section</span>
          <select value={adding} onChange={(e) => setAdding(e.target.value as SectionType)} className="admin-input">
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SECTION_LABELS[t].label}: {SECTION_LABELS[t].hint}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => {
            const s = blankSection(adding, newId()) as unknown as Rec;
            setSections((x) => [...x, s]);
            setOpen(String(s.id));
            touch();
          }}
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  def,
  sectionId,
  value,
  forms,
  onChange,
}: {
  def: FieldDef;
  sectionId: string;
  value: unknown;
  forms: { key: string; name: string }[];
  onChange: (v: unknown) => void;
}) {
  const id = `s-${sectionId}-${def.key}`;
  const label = (
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#3a3733]">
      {def.label}
    </label>
  );
  const hint = "hint" in def && def.hint ? <p className="mt-1 text-xs text-[#78736b]">{def.hint}</p> : null;
  switch (def.kind) {
    case "text":
      return (
        <div>
          {label}
          <input id={id} className="admin-input" value={String(value ?? "")} maxLength={def.max} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </div>
      );
    case "textarea":
      return (
        <div>
          {label}
          <textarea id={id} className="admin-input leading-relaxed" rows={def.rows ?? 4} value={String(value ?? "")} maxLength={def.max} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </div>
      );
    case "number":
      return (
        <div className="max-w-[200px]">
          {label}
          <input id={id} type="number" className="admin-input" min={def.min} max={def.max} value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value) || 0)} />
          {hint}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#1c1b19]" />
          {def.label}
        </label>
      );
    case "select":
      return (
        <div className="max-w-[260px]">
          {label}
          <select id={id} className="admin-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "form":
      return (
        <div className="max-w-[260px]">
          {label}
          <select id={id} className="admin-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {forms.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      );
    case "cta": {
      const v = (value as { label: string; href: string }) ?? { label: "", href: "" };
      return (
        <fieldset className="rounded-md border border-[#ece9e4] p-3">
          <legend className="px-1 text-sm font-medium">{def.label}</legend>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <input aria-label={`${def.label} text`} placeholder="Button text" className="admin-input" maxLength={40} value={v.label} onChange={(e) => onChange({ ...v, label: e.target.value })} />
            <input
              aria-label={`${def.label} link`}
              placeholder="/our-menus, https://…, tel:…, or book"
              className="admin-input"
              value={v.href}
              onChange={(e) => onChange({ ...v, href: e.target.value.trim() })}
            />
          </div>
          <p className="mt-1 text-xs text-[#78736b]">Use &quot;book&quot; for the Book Table link from Business settings. Leave both empty for no button.</p>
        </fieldset>
      );
    }
    case "media":
      return <MediaFieldBridge name={id} label={def.label} type={def.type} value={String(value ?? "")} hint={"hint" in def ? def.hint : undefined} onChange={onChange} />;
    case "mediaList":
      return <MediaListBridge name={id} label={def.label} value={(value as string[]) ?? []} onChange={onChange} />;
  }
}

/** MediaField/MediaListField write to hidden inputs; mirror their value into section state. */
function MediaFieldBridge({ name, label, type, value, hint, onChange }: { name: string; label: string; type?: "image" | "video"; value: string; hint?: string; onChange: (v: string) => void }) {
  return (
    <div
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.name === name) onChange(t.value);
      }}
    >
      <MediaField name={name} label={label} defaultId={value || null} type={type} hint={hint} />
    </div>
  );
}

function MediaListBridge({ name, label, value, onChange }: { name: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [initial] = useState(value);
  return (
    <div
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.name === name) onChange(t.value ? t.value.split(",") : []);
      }}
    >
      <MediaListField name={name} label={label} defaultIds={initial} />
    </div>
  );
}
