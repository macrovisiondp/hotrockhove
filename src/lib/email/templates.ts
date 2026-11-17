import "server-only";
import type { EmailBrand } from "./brand";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/* Website palette (src/app/globals.css). */
const INK = "#0b0a09";
const INK_SOFT = "#191715";
const BONE = "#f2ede6";
const STONE = "#c9c1b6";
const MUTE = "#948b80";
const PAPER = "#f7f3ee";
const RULE = "#e7e0d6";
const TEXT = "#1c1917";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "Inter,Helvetica,Arial,sans-serif";

const safeUrl = (u: string) => (/^https?:\/\/[^\s"<>]+$/.test(u) ? u : "");
const safeHttps = (u: string) => (/^https:\/\/[^\s"<>]+$/.test(u) ? u : "");
const safeHex = (c: string | undefined) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#ba9774");

/**
 * Branded email layout matching the website: dark header with the logo, a light
 * reading panel, bronze accents and a dark contact footer. Body text is plain text
 * from admin-configured templates or submission data — always escaped, line
 * breaks preserved. Tables + inline styles only, for email-client compatibility.
 */
export function layout(opts: {
  brandName: string;
  /** Logo, colours and contact footer. Without it, the brand name is shown as text. */
  brand?: EmailBrand;
  /** Small label above the heading, e.g. "Birthday enquiry". */
  eyebrow?: string;
  heading: string;
  paragraphs: string[];
  rows?: [string, string][];
  /** Caption above the rows table, e.g. "Your details". */
  rowsTitle?: string;
  footer?: string;
  /** Optional button (https URL only). */
  cta?: { label: string; url: string };
  /** Marketing emails: a clickable unsubscribe link in the footer. */
  unsubscribeUrl?: string;
}) {
  const b = opts.brand;
  const accent = safeHex(b?.accent);
  const name = escapeHtml(b?.name || opts.brandName);
  const siteUrl = b ? safeUrl(b.siteUrl) : "";
  const logoUrl = b ? safeUrl(b.logoUrl) : "";

  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="140" alt="${name}" style="display:block;margin:0 auto;width:140px;max-width:140px;height:auto;border:0;outline:none;text-decoration:none;color:${BONE};font-family:${SERIF};font-size:24px">`
    : `<span style="font-family:${SERIF};font-size:26px;letter-spacing:.12em;text-transform:uppercase;color:${BONE}">${name}</span>`;
  const header = `<tr><td align="center" style="background:${INK};padding:28px 32px 24px">${siteUrl ? `<a href="${escapeHtml(siteUrl)}" style="text-decoration:none">${logo}</a>` : logo}</td></tr>
<tr><td style="background:${accent};height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>`;

  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:.24em;text-transform:uppercase;color:${accent}">${escapeHtml(opts.eyebrow)}</p>`
    : "";
  const p = opts.paragraphs
    .map((para) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${TEXT}">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const rowsTitle = opts.rowsTitle
    ? `<p style="margin:24px 0 6px;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;color:${MUTE}">${escapeHtml(opts.rowsTitle)}</p>`
    : "";
  const rows = opts.rows?.length
    ? `${rowsTitle}<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:${opts.rowsTitle ? "0" : "8px"} 0 16px;border-top:2px solid ${accent}">${opts.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 14px 10px 0;border-bottom:1px solid ${RULE};font-family:${SANS};font-size:13px;color:#6b6258;vertical-align:top;width:38%">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid ${RULE};font-family:${SANS};font-size:14px;color:${TEXT};vertical-align:top">${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const ctaUrl = opts.cta ? safeHttps(opts.cta.url) : "";
  const cta =
    opts.cta && ctaUrl && opts.cta.label
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 18px"><tr><td style="background:${accent}"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase;color:${INK};text-decoration:none">${escapeHtml(opts.cta.label)}</a></td></tr></table>`
      : "";

  const unsubUrl = opts.unsubscribeUrl ? safeHttps(opts.unsubscribeUrl) : "";
  const contact = b ? [b.address, b.phone, b.email].filter(Boolean).map(escapeHtml).join(" &nbsp;·&nbsp; ") : "";
  const footerLines = [
    b ? `<p style="margin:0 0 6px;font-family:${SERIF};font-size:18px;letter-spacing:.06em;color:${BONE}">${name}</p>` : "",
    contact ? `<p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${STONE}">${contact}</p>` : "",
    siteUrl ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:12px"><a href="${escapeHtml(siteUrl)}" style="color:${accent};text-decoration:none">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a></p>` : "",
    opts.footer ? `<p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:${MUTE}">${escapeHtml(opts.footer)}</p>` : "",
    unsubUrl ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:11px"><a href="${escapeHtml(unsubUrl)}" style="color:${MUTE}">Unsubscribe</a></p>` : "",
  ].join("");
  const footerHtml = footerLines ? `<tr><td align="center" style="background:${INK_SOFT};padding:24px 32px">${footerLines}</td></tr>` : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-collapse:collapse">
${header}
<tr><td style="padding:36px 36px 20px">
${eyebrow}<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:30px;line-height:1.2;font-weight:normal;color:${TEXT}">${escapeHtml(opts.heading)}</h1>
${p}${rows}${cta}
</td></tr>
${footerHtml}
</table></td></tr></table></body></html>`;

  const text = [
    b?.name || opts.brandName,
    "",
    ...(opts.eyebrow ? [opts.eyebrow.toUpperCase()] : []),
    opts.heading,
    "",
    ...opts.paragraphs,
    ...(opts.rows?.length ? ["", ...(opts.rowsTitle ? [opts.rowsTitle] : []), ...opts.rows.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(opts.cta && ctaUrl && opts.cta.label ? ["", `${opts.cta.label}: ${ctaUrl}`] : []),
    "",
    "—",
    ...(b ? [[b.name, b.address, b.phone, b.email].filter(Boolean).join(" · "), b.siteUrl] : []),
    ...(opts.footer ? [opts.footer] : []),
    ...(unsubUrl ? [`Unsubscribe: ${unsubUrl}`] : []),
  ].join("\n");
  return { html, text };
}
