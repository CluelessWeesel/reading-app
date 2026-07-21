import { daysBetweenInclusive } from "../shared/isoDate";
import { buildYearSeriesByDayOfYear } from "../stats/statsMath";
import type { DailyRow } from "../stats/types";

export type YearAtDay = { year: number; pages: number; isCurrent: boolean };

// Every tracked year's cumulative pages at the same day-of-year as today,
// for a direct year-over-year bar comparison. Skips a year entirely if it
// has no reading at all by that point (nothing to show), and returns null
// if that leaves fewer than two years to compare.
export function computeAmongTheYears(dailyRows: DailyRow[], years: number[], currentYear: number, today: string): YearAtDay[] | null {
  const dayOfYear = daysBetweenInclusive(`${currentYear}-01-01`, today) - 1;

  const points = years
    .map((year) => {
      const series = buildYearSeriesByDayOfYear(dailyRows, year);
      const idx = Math.min(dayOfYear, series.length - 1);
      return { year, pages: series[idx]?.y ?? 0, isCurrent: year === currentYear };
    })
    .filter((p) => p.pages > 0);

  return points.length >= 2 ? points : null;
}
