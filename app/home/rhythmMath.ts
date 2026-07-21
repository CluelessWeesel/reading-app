import { addIsoDays } from "../shared/isoDate";
import type { DailyRow } from "../stats/types";

export type RhythmNight = { date: string; pages: number; isToday: boolean; isBest: boolean };

// Last 14 calendar nights ending today, zero-filled for nights with no
// daily_reading row at all (not just a 0-pages row -- there usually isn't
// one either way). isBest marks the single highest night, not ties, so at
// most one bar ever gets the full-accent treatment.
export function computeRhythm(dailyRows: DailyRow[], today: string): RhythmNight[] {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  const nights: { date: string; pages: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addIsoDays(today, -i);
    nights.push({ date, pages: byDate.get(date) ?? 0 });
  }

  const maxPages = Math.max(...nights.map((n) => n.pages));
  let bestMarked = false;
  return nights.map((n) => {
    const isBest = maxPages > 0 && n.pages === maxPages && !bestMarked;
    if (isBest) bestMarked = true;
    return { ...n, isToday: n.date === today, isBest };
  });
}
