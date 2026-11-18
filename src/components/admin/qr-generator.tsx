"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { normaliseBase, qrFileName, qrUrl, type QrKind, type QrTarget } from "@/domain/qr";

const KINDS: { kind: QrKind; label: string }[] = [
  { kind: "page", label: "Page" },
  { kind: "menuItem", label: "Menu item" },
  { kind: "offer", label: "Offer" },
  { kind: "product", label: "Product" },
];

/** Downloads text or a data URL as a file, without leaving the page. */
function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function QrGenerator({ targets, defaultBase }: { targets: QrTarget[]; defaultBase: string }) {
  const kinds = KINDS.filter((k) => targets.some((t) => t.kind === k.kind));
  const [kind, setKind] = useState<QrKind>(kinds[0]?.kind ?? "page");
  const options = useMemo(() => targets.filter((t) => t.kind === kind), [targets, kind]);
  const [index, setIndex] = useState(0);
  const [baseText, setBaseText] = useState(defaultBase);
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const target = options[Math.min(index, options.length - 1)];
  const base = normaliseBase(baseText);
  const url = target && base ? qrUrl(base, target) : null;

  useEffect(() => {
    let live = true;
    if (!url) return;
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" }).then((d) => {
      if (live) setPng(d);
    });
    return () => {
      live = false;
    };
  }, [url]);

  if (targets.length === 0)
    return <p className="admin-card p-6 text-sm">Publish a page, menu item, offer or product first.</p>;

  const file = target ? qrFileName(target.label) : "qr";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="admin-card space-y-5 p-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">What is it for?</legend>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <label key={k.kind} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="qr-kind"
                  checked={kind === k.kind}
                  onChange={() => {
                    setKind(k.kind);
                    setIndex(0);
                  }}
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="qr-target" className="mb-1 block text-sm font-medium">
            {KINDS.find((k) => k.kind === kind)?.label}
          </label>
          <select
            id="qr-target"
            className="admin-input w-full"
            value={Math.min(index, options.length - 1)}
            onChange={(e) => setIndex(Number(e.currentTarget.value))}
          >
            {options.map((o, i) => (
              <option key={`${o.path}#${o.anchor ?? ""}`} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qr-base" className="mb-1 block text-sm font-medium">
            Website address
          </label>
          <input
            id="qr-base"
            className="admin-input w-full"
            value={baseText}
            onChange={(e) => setBaseText(e.currentTarget.value)}
            aria-describedby="qr-base-help"
          />
          <p id="qr-base-help" className="mt-1 text-xs text-[var(--admin-muted,#6b7280)]">
            The QR code opens this address. Keep the current one until hotrockhove.com points at the new site; codes made
            with it keep working afterwards.
          </p>
          {!base && <p className="mt-1 text-sm text-red-700">Enter a web address, for example hotrockhove.com.</p>}
        </div>
        {url && (
          <div>
            <p className="mb-1 text-sm font-medium">Link in the QR code</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-black/5 px-2 py-1 text-xs">{url}</code>
              <button
                type="button"
                className="admin-btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a href={url} target="_blank" rel="noreferrer" className="admin-btn">
                Open
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card flex flex-col items-center gap-4 p-6">
        {url && png ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img src={png} alt={`QR code for ${target?.label}`} className="h-64 w-64 bg-white p-2" />
            <p className="text-center text-sm font-medium">{target?.label}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => download(png, `${file}.png`)}>
                Download PNG
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={async () => {
                  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
                  download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, `${file}.svg`);
                }}
              >
                Download SVG
              </button>
            </div>
            <p className="text-center text-xs text-[var(--admin-muted,#6b7280)]">
              PNG for documents and social posts; SVG for printers (stays sharp at any size).
            </p>
          </>
        ) : (
          <p className="text-sm">Choose something to make a QR code for.</p>
        )}
      </div>
    </div>
  );
}
