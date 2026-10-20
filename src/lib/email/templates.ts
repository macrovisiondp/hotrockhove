import "server-only";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Minimal branded layout. Body text is plain text from admin-configured templates
 * or submission data — always escaped, line breaks preserved.
 */
export function layout(opts: { brandName: string; heading: string; paragraphs: string[]; rows?: [string, string][]; footer?: string }) {
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
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0c0a09;color:#f5efe6;padding:20px 28px;font-family:Georgia,serif;font-size:20px;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(opts.brandName)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal">${escapeHtml(opts.heading)}</h1>
${p}${rows}
</td></tr>
${opts.footer ? `<tr><td style="padding:16px 28px;background:#faf8f5;color:#78716c;font-size:12px;line-height:1.5">${escapeHtml(opts.footer)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
  const text = [
    opts.heading,
    "",
    ...opts.paragraphs,
    ...(opts.rows?.length ? ["", ...opts.rows.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(opts.footer ? ["", opts.footer] : []),
  ].join("\n");
  return { html, text };
}
