/**
 * CSV encoding with protection against spreadsheet formula injection: values
 * starting with = + - @ (or tab/CR) are prefixed with an apostrophe so Excel and
 * Sheets treat them as text.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (£, accents, emoji) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
