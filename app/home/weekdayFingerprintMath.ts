const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKEND = new Set(["Saturday", "Sunday"]);

export type WeekdayBar = {
  day: string;
  shortDay: string;
  avgPages: number;
  totalPages: number;
  isBest: boolean;
  isNearZero: boolean;
};
export type WeekdayFingerprint = { bars: WeekdayBar[]; diagnosis: string };

// Small set of phrasings, picked by which day leads/trails rather than one
// fixed template -- a weekend-vs-weekday split reads differently from two
// adjacent weekdays, and a near-even week deserves its own honest phrasing
// rather than overstating a marginal lead.
function buildDiagnosis(bestDay: string, worstDay: string, bestAvg: number, worstAvg: number): string {
  const spreadRatio = worstAvg > 0 ? bestAvg / worstAvg : Infinity;
  if (spreadRatio < 1.4) {
    return `Pretty even across the week -- ${bestDay}s edge it slightly.`;
  }
  if (WEEKEND.has(bestDay) && !WEEKEND.has(worstDay)) {
    return `A weekend reader -- ${worstDay}s run on fumes.`;
  }
  if (!WEEKEND.has(bestDay) && WEEKEND.has(worstDay)) {
    return `A weekday grinder -- weekends are lighter going.`;
  }
  return `A ${bestDay} reader -- ${worstDay}s run on fumes.`;
}

// Average (and total) pages per day-of-week, computed from every
// daily_reading row that falls in the given year (rows only exist for days
// something was actually logged -- see recordsMath.ts's buildDenseSeries
// note -- so this is an average over logged days, not every calendar day).
export function computeWeekdayFingerprint(
  dailyRows: { date: string; pages: number }[],
  year: number
): WeekdayFingerprint | null {
  const yearRows = dailyRows.filter((r) => r.date.startsWith(String(year)));
  // Needs a couple of instances of most weekdays to mean anything --
  // otherwise one big Tuesday session would crown "Tuesday" off a sample
  // size of one.
  if (yearRows.length < 14) return null;

  const sums = new Array(7).fill(0) as number[];
  const counts = new Array(7).fill(0) as number[];
  for (const r of yearRows) {
    const dow = new Date(`${r.date}T00:00:00Z`).getUTCDay();
    sums[dow] += r.pages;
    counts[dow]++;
  }
  const avgs = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  const maxAvg = Math.max(...avgs);
  if (maxAvg <= 0) return null;
  const minAvg = Math.min(...avgs);
  const bestIdx = avgs.indexOf(maxAvg);
  const worstIdx = avgs.indexOf(minAvg);

  const bars: WeekdayBar[] = avgs.map((avgPages, i) => ({
    day: DAY_NAMES[i],
    shortDay: DAY_SHORT[i],
    avgPages,
    totalPages: sums[i],
    isBest: i === bestIdx,
    isNearZero: avgPages > 0 && avgPages < maxAvg * 0.15,
  }));

  return {
    bars,
    diagnosis: buildDiagnosis(DAY_NAMES[bestIdx], DAY_NAMES[worstIdx], maxAvg, minAvg),
  };
}
