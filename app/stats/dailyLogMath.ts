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
  const todayLogged = byDate.has(today);

  const rows: DailyLogRow[] = [];
  let cumulative = 0;
  let dayNumber = 0;
  let d = `${year}-01-01`;
  while (d <= end) {
    dayNumber++;
    const pagesToday = byDate.get(d) ?? 0;
    cumulative += pagesToday;
    // Only the very last row (today, when it's the scope's own end date)
    // can be unlogged -- every earlier day is fully past and already has
    // whatever it's going to have. Dividing by dayNumber there anyway would
    // count today as a complete day before it's had any real chance to be
    // one, dipping `projected`/`yearlyAverage` right at the most recent row.
    const isUnloggedToday = d === today && d === end && !todayLogged;
    const divisor = isUnloggedToday ? Math.max(1, dayNumber - 1) : dayNumber;
    rows.push({
      date: d,
      cumulative,
      pagesToday,
      projected: (cumulative * 365) / divisor,
      dailyProjection: pagesToday * 365,
      yearlyAverage: cumulative / divisor,
    });
    d = addIsoDays(d, 1);
  }
  return rows;
}
