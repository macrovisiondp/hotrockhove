import "server-only";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Minimal branded layout. Body text is plain text from admin-configured templates
 * or submission data — always escaped, line breaks preserved.
 */
export function layout(opts: {
  brandName: string;
  heading: string;
  paragraphs: string[];
  rows?: [string, string][];
  footer?: string;
  /** Optional button (https URL only). */
  cta?: { label: string; url: string };
  /** Marketing emails: a clickable unsubscribe link in the footer. */
  unsubscribeUrl?: string;
}) {
  const p = opts.paragraphs
    .map((para) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const rows = opts.rows?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px">${opts.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e5e1da;color:#6b6258;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e1da;vertical-align:top">${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const safeUrl = (u: string) => (/^https:\/\/[^\s"<>]+$/.test(u) ? u : "");
  const ctaUrl = opts.cta ? safeUrl(opts.cta.url) : "";
  const cta =
    opts.cta && ctaUrl && opts.cta.label
      ? `<p style="margin:8px 0 16px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#b08a5e;color:#0c0a09;text-decoration:none;padding:12px 22px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;font-size:13px">${escapeHtml(opts.cta.label)}</a></p>`
      : "";
  const unsubUrl = opts.unsubscribeUrl ? safeUrl(opts.unsubscribeUrl) : "";
  const unsub = unsubUrl ? `<br><a href="${escapeHtml(unsubUrl)}" style="color:#78716c">Unsubscribe</a>` : "";
  const footerHtml =
    opts.footer || unsub
      ? `<tr><td style="padding:16px 28px;background:#faf8f5;color:#78716c;font-size:12px;line-height:1.5">${escapeHtml(opts.footer ?? "")}${unsub}</td></tr>`
      : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0c0a09;color:#f5efe6;padding:20px 28px;font-family:Georgia,serif;font-size:20px;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(opts.brandName)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal">${escapeHtml(opts.heading)}</h1>
${p}${rows}${cta}
</td></tr>
${footerHtml}
</table></td></tr></table></body></html>`;
  const text = [
    opts.heading,
    "",
    ...opts.paragraphs,
    ...(opts.rows?.length ? ["", ...opts.rows.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(opts.cta && ctaUrl && opts.cta.label ? ["", `${opts.cta.label}: ${ctaUrl}`] : []),
    ...(opts.footer ? ["", opts.footer] : []),
    ...(unsubUrl ? ["", `Unsubscribe: ${unsubUrl}`] : []),
  ].join("\n");
  return { html, text };
}
