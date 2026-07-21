import { addIsoDays, daysBetweenInclusive } from "../shared/isoDate";
import { formatDateShort } from "../shared/formatDateShort";

export type MetronomePoint = { date: string; rollingAvg: number };
export type Metronome = {
  points: MetronomePoint[]; // last ~90 days, for the sparkline
  cruise: number;
  current: number;
  verdict: string;
  annotation: string;
};

// dailyRows only contains dates with an actual daily_reading row -- a day
// with zero reading is simply absent, not present with pages=0 (same note
// as recordsMath.ts's buildDenseSeries). Rolling averages need every
// calendar day accounted for, so gaps are filled with 0 here first.
function buildDensePagesMap(dailyRows: { date: string; pages: number }[], start: string, end: string): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const r of dailyRows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.pages);
  const dense = new Map<string, number>();
  let d = start;
  while (d <= end) {
    dense.set(d, byDate.get(d) ?? 0);
    d = addIsoDays(d, 1);
  }
  return dense;
}

function computeVerdict(current: number, past: number, cruise: number): string {
  const above = current >= cruise;
  const delta = current - past;
  const threshold = Math.max(cruise * 0.05, 0.5);
  const rising = delta > threshold;
  const falling = delta < -threshold;

  if (above) {
    if (rising) return "Above cruise, climbing";
    if (falling) return "Above cruise, easing back";
    return "Above cruise, steady";
  }
  if (rising) return "Below cruise, climbing back";
  if (falling) return "Below cruise, falling further";
  return "Below cruise, steady";
}

// The most recent below-to-above crossing, honestly phrased the other way
// if currently below -- scanned across the FULL rolling series (not just
// the ~90-day plotted window), so a slump that ended long before the chart
// starts still gets credited correctly.
function computeAnnotation(rollingSeries: MetronomePoint[], cruise: number, today: string): string {
  let lastCrossing: { date: string; direction: "up" | "down" } | null = null;
  for (let i = 1; i < rollingSeries.length; i++) {
    const prevAbove = rollingSeries[i - 1].rollingAvg >= cruise;
    const nowAbove = rollingSeries[i].rollingAvg >= cruise;
    if (prevAbove !== nowAbove) {
      lastCrossing = { date: rollingSeries[i].date, direction: nowAbove ? "up" : "down" };
    }
  }

  const nowAbove = rollingSeries[rollingSeries.length - 1].rollingAvg >= cruise;

  if (nowAbove) {
    if (lastCrossing && lastCrossing.direction === "up") {
      const daysSince = daysBetweenInclusive(lastCrossing.date, today) - 1;
      return `Slump ended ${formatDateShort(lastCrossing.date)} -- ${daysSince} day${daysSince === 1 ? "" : "s"} above cruise since`;
    }
    return "Above cruise since tracking began";
  }

  const sinceDate = lastCrossing && lastCrossing.direction === "down" ? lastCrossing.date : rollingSeries[0].date;
  return `Below cruise since ${formatDateShort(sinceDate)}`;
}

// cruise = lifetime average pages/day (same total-pages/total-days
// definition already used for lifetimeData.pagesPerDay on the Odometer
// band), plotted as a dashed reference line against the 30-day rolling
// average -- the "are we, right now, reading at our own normal pace"
// question.
export function computeMetronome(
  dailyRows: { date: string; pages: number }[],
  cruise: number,
  today: string
): Metronome | null {
  if (cruise <= 0 || dailyRows.length === 0) return null;

  const earliestDate = dailyRows.reduce((min, r) => (r.date < min ? r.date : min), dailyRows[0].date);
  const rollingStart = addIsoDays(earliestDate, 29);
  if (rollingStart > today) return null;

  const dense = buildDensePagesMap(dailyRows, earliestDate, today);
  const rollableDates = Array.from(dense.keys()).filter((d) => d >= rollingStart);
  if (rollableDates.length === 0) return null;

  const rollingSeries: MetronomePoint[] = rollableDates.map((date) => {
    let sum = 0;
    for (let k = 0; k < 30; k++) sum += dense.get(addIsoDays(date, -k)) ?? 0;
    return { date, rollingAvg: sum / 30 };
  });

  // Needs 30+ genuinely logged days within the plotted ~90-day window (plus
  // its 30-day lookback) -- not just calendar days -- otherwise a mostly-
  // empty recent stretch would still draw a flat, misleading line.
  const windowStart = addIsoDays(today, -119);
  const loggedInWindow = dailyRows.filter((r) => r.date >= windowStart && r.date <= today).length;
  if (loggedInWindow < 30) return null;

  const points = rollingSeries.slice(-90);
  const current = rollingSeries[rollingSeries.length - 1].rollingAvg;
  const past = rollingSeries[Math.max(0, rollingSeries.length - 15)].rollingAvg;

  return {
    points,
    cruise,
    current,
    verdict: computeVerdict(current, past, cruise),
    annotation: computeAnnotation(rollingSeries, cruise, today),
  };
}
