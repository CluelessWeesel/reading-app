import { addIsoDays } from "../shared/isoDate";
import type { DailyRow } from "./types";

export type DailyLogRow = {
  date: string;
  cumulative: number;
  pagesToday: number;
  projected: number;
  dailyProjection: number;
  yearlyAverage: number;
};

// One row per day of `year`, from Jan 1 through Dec 31 (or through `today`
// for the current year, since later days don't exist yet). `projected` and
// `yearlyAverage` both use the whole-year-to-date pace (cumulative / day
// number) -- the same smoothing computeProjectionSeries uses for its chart,
// just also exposed per-day here. `dailyProjection` deliberately uses only
// that single day's pages (pagesToday * 365), which is why it's far more
// volatile than `projected` and isn't heat-colored in the UI.
export function computeDailyLog(
  dailyRows: DailyRow[],
  year: number,
  today: string,
  currentYear: number
): DailyLogRow[] {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  const end = year === currentYear ? today : `${year}-12-31`;

  const rows: DailyLogRow[] = [];
  let cumulative = 0;
  let dayNumber = 0;
  let d = `${year}-01-01`;
  while (d <= end) {
    dayNumber++;
    const pagesToday = byDate.get(d) ?? 0;
    cumulative += pagesToday;
    rows.push({
      date: d,
      cumulative,
      pagesToday,
      projected: (cumulative * 365) / dayNumber,
      dailyProjection: pagesToday * 365,
      yearlyAverage: cumulative / dayNumber,
    });
    d = addIsoDays(d, 1);
  }
  return rows;
}
