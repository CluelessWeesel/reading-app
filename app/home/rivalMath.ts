import { daysBetweenInclusive } from "../shared/isoDate";
import { buildYearSeriesByDayOfYear } from "../stats/statsMath";
import type { DailyRow } from "../stats/types";

export type RivalData = {
  dayOfYear: number;
  currentPages: number;
  rivalPages: number;
  rivalYear: number;
  delta: number; // positive = ahead of the rival year, negative = behind
};

// "Rivalry" is against a fixed best-ever year (2023, your highest page
// total), not always "last year" -- same day-of-year comparison either
// way. Returns null if there's no data for that year to compare against
// at all.
const RIVAL_YEAR = 2023;

export function computeRival(dailyRows: DailyRow[], currentYear: number, today: string): RivalData | null {
  const dayOfYear = daysBetweenInclusive(`${currentYear}-01-01`, today) - 1;

  const currentSeries = buildYearSeriesByDayOfYear(dailyRows, currentYear);
  const rivalSeries = buildYearSeriesByDayOfYear(dailyRows, RIVAL_YEAR);

  const currentPages = currentSeries[dayOfYear]?.y ?? 0;
  const rivalPages = rivalSeries[Math.min(dayOfYear, rivalSeries.length - 1)]?.y ?? 0;
  if (currentPages === 0 && rivalPages === 0) return null;

  return { dayOfYear, currentPages, rivalPages, rivalYear: RIVAL_YEAR, delta: currentPages - rivalPages };
}
