// Today's date as "YYYY-MM-DD" in the machine's local timezone -- NOT
// `new Date().toISOString()`, which is always UTC and rolls over at UTC
// midnight (mid-morning or later for timezones ahead of UTC). This app only
// ever runs on the same machine as its one user (browser and `next dev`
// server share a clock), so the local calendar day is the correct "today"
// everywhere it's used, both for display and for what gets written to the DB.
export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Pure ISO-date-string ("YYYY-MM-DD") math, anchored to UTC midnight to
// avoid local-timezone drift when just diffing/adding whole days.
export function addIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}
