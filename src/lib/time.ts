/** Offset (ms) of Europe/London from UTC at a given instant (0 in winter, +1h in summer). */
function londonOffset(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Parse "YYYY-MM-DDTHH:MM" entered as UK wall-clock time into a UTC Date. */
export function parseLondonLocal(v: string): Date | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Reject impossible dates (Date.UTC would roll 2026-13-01 over into 2027).
  const check = new Date(wall);
  if (check.getUTCMonth() !== +m[2] - 1 || check.getUTCDate() !== +m[3] || +m[4] > 23 || +m[5] > 59) return null;
  // Two passes handle the DST boundary correctly.
  let utc = wall - londonOffset(wall);
  utc = wall - londonOffset(utc);
  return new Date(utc);
}
