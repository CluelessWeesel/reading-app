import { addIsoDays, daysBetweenInclusive } from "../shared/isoDate";
import type {
  BookSummary,
  DailyRow,
  FormatDailyRow,
  FormatStat,
  Goal,
  PastYearVerdict,
  ProjectionInfo,
  Scope,
  ScopeData,
} from "./types";

// Matches the lowercase "29.4k" / "28.9k" style used for pace headlines --
// distinct from formatCompactNumber's uppercase Intl output used elsewhere.
export function formatPagesK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function scopeDateRange(
  scope: Scope,
  today: string,
  currentYear: number
): { start: string; end: string } {
  if (scope.kind === "all") return { start: "2023-01-01", end: today };
  const start = `${scope.year}-01-01`;
  const end = scope.year === currentYear ? today : `${scope.year}-12-31`;
  return { start, end };
}

function buildSeries(dailyRows: DailyRow[], start: string, end: string) {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  const series: { date: string; pages: number; cumulative: number }[] = [];
  let cumulative = 0;
  let d = start;
  while (d <= end) {
    const pages = byDate.get(d) ?? 0;
    cumulative += pages;
    series.push({ date: d, pages, cumulative });
    d = addIsoDays(d, 1);
  }
  return series;
}

// A prior year's full cumulative curve, indexed by day-of-year (x=0 is
// Jan 1) rather than calendar date -- that's what lets it overlay directly
// on the current year's own day-of-year x-axis for comparison.
export function buildYearSeriesByDayOfYear(dailyRows: DailyRow[], year: number): { x: number; y: number }[] {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  const points: { x: number; y: number }[] = [];
  let cumulative = 0;
  let d = `${year}-01-01`;
  const end = `${year}-12-31`;
  let x = 0;
  while (d <= end) {
    cumulative += byDate.get(d) ?? 0;
    points.push({ x, y: cumulative });
    d = addIsoDays(d, 1);
    x++;
  }
  return points;
}

function computeBestStreak(activeDates: Set<string>, start: string, end: string): number {
  let best = 0;
  let current = 0;
  let d = start;
  while (d <= end) {
    if (activeDates.has(d)) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
    d = addIsoDays(d, 1);
  }
  return best;
}

// Walked from today (or yesterday, if today hasn't been logged yet --
// a streak isn't "broken" until a full day passes with no activity, matching
// how most streak trackers behave) backward against the *entire* history,
// not clipped to the scope's start -- a streak that began before Jan 1
// shouldn't be cut short just because the current-year scope's window
// starts there.
function computeCurrentStreak(activeDates: Set<string>, today: string): number {
  const yesterday = addIsoDays(today, -1);
  let anchor: string;
  if (activeDates.has(today)) anchor = today;
  else if (activeDates.has(yesterday)) anchor = yesterday;
  else return 0;

  let streak = 0;
  let d = anchor;
  while (activeDates.has(d)) {
    streak++;
    d = addIsoDays(d, -1);
  }
  return streak;
}

export type ProjectionYearSeries = { year: number; points: { x: number; y: number }[]; isCurrent: boolean };

// Rolling projection: on day d, projection = pages-read-year-to-date *
// (365 / d). Reuses buildYearSeriesByDayOfYear's cumulative curve for each
// year -- a past year's curve runs the full 365 days (converging to its
// actual final by construction, since projection(365) = total * 365/365 =
// total); the current year's curve stops at today. In year scope, only that
// year is shown (highlighted, since it's the only line); in all-time scope,
// every year is shown with only the real current year highlighted.
export function computeProjectionSeries(
  dailyRows: DailyRow[],
  years: number[],
  currentYear: number,
  today: string,
  scope: Scope
): ProjectionYearSeries[] {
  const yearsToShow = scope.kind === "all" ? years : [scope.year];
  return yearsToShow.map((year) => {
    const cumulative = buildYearSeriesByDayOfYear(dailyRows, year);
    const isRealCurrentYear = year === currentYear;
    const truncateAt = isRealCurrentYear
      ? daysBetweenInclusive(`${year}-01-01`, today) - 1
      : cumulative.length - 1;
    const points = cumulative
      .filter((p) => p.x <= truncateAt)
      .map((p) => ({ x: p.x, y: (p.y * 365) / (p.x + 1) }));
    return { year, points, isCurrent: scope.kind === "year" ? true : isRealCurrentYear };
  });
}

// "Physical" reading includes ebook days too -- eye-reading a screen paces
// like a printed page, not like an audiobook, so ebook is grouped with
// physical rather than held out as a third bucket here.
function formatStatFor(rows: FormatDailyRow[], types: string[]): FormatStat {
  const matching = rows.filter((r) => types.includes(r.format_type));
  if (matching.length === 0) return null;
  const avgPages = matching.reduce((sum, r) => sum + r.pages, 0) / matching.length;
  return { avgPages, days: matching.length };
}

export function computeScopeData({
  scope,
  today,
  currentYear,
  dailyRows,
  formatDailyRows,
  books,
  goals,
}: {
  scope: Scope;
  today: string;
  currentYear: number;
  dailyRows: DailyRow[];
  formatDailyRows: FormatDailyRow[];
  books: BookSummary[];
  goals: Goal[];
}): ScopeData {
  const { start, end } = scopeDateRange(scope, today, currentYear);
  const totalDays = daysBetweenInclusive(start, end);

  const series = buildSeries(dailyRows, start, end);
  const totalPages = series.length > 0 ? series[series.length - 1].cumulative : 0;
  const readingDays = series.filter((s) => s.pages > 0).length;

  const activeDates = new Set(dailyRows.filter((r) => r.pages > 0).map((r) => r.date));
  const bestStreak = computeBestStreak(activeDates, start, end);
  const isCurrentYearScope = scope.kind === "year" && scope.year === currentYear;
  const currentStreak = isCurrentYearScope ? computeCurrentStreak(activeDates, today) : null;

  // "Books finished" requires a real completion date -- year_read alone
  // doesn't mean finished (a couple of books carry year_read with no
  // date_finished, score, or status, and aren't actually done yet).
  const finishedBooks = books.filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end);
  const booksFinished = finishedBooks.length;
  const avgBookLength =
    booksFinished > 0 ? finishedBooks.reduce((sum, b) => sum + b.page_count, 0) / booksFinished : null;

  // No per-day word log exists, so words are derived from the same
  // continuous page total using a single global words-per-page ratio --
  // consistent with the per-book "words/page" stat on the dossier page,
  // just averaged across every book instead of one.
  const ratioSamples = books.filter((b) => b.word_count != null && b.page_count > 0);
  const globalWordsPerPage =
    ratioSamples.length > 0
      ? ratioSamples.reduce((sum, b) => sum + (b.word_count as number), 0) /
        ratioSamples.reduce((sum, b) => sum + b.page_count, 0)
      : 0;
  const totalWordsEstimate = totalPages * globalWordsPerPage;

  const pagesPerDay = totalDays > 0 ? totalPages / totalDays : 0;
  const wordsPerDay = totalDays > 0 ? totalWordsEstimate / totalDays : 0;

  const goal = scope.kind === "year" ? (goals.find((g) => g.year === scope.year)?.pages_goal ?? null) : null;
  let projection: ProjectionInfo | null = null;
  let pastYearVerdict: PastYearVerdict | null = null;

  if (scope.kind === "year" && goal != null) {
    if (scope.year === currentYear) {
      const daysInFullYear = daysBetweenInclusive(`${scope.year}-01-01`, `${scope.year}-12-31`);
      const avgPace = totalDays > 0 ? totalPages / totalDays : 0;
      const projectedTotal = avgPace * daysInFullYear;
      projection = { projectedTotal, verdict: projectedTotal >= goal ? "on track" : "behind pace" };
    } else {
      pastYearVerdict = { finalTotal: totalPages, verdict: totalPages >= goal ? "met" : "missed" };
    }
  }

  const scopedFormatRows = formatDailyRows.filter((r) => r.date >= start && r.date <= end);
  const physical = formatStatFor(scopedFormatRows, ["physical", "ebook"]);
  const audio = formatStatFor(scopedFormatRows, ["audio"]);

  return {
    scope,
    start,
    end,
    totalDays,
    series,
    totalPages,
    readingDays,
    bestStreak,
    currentStreak,
    booksFinished,
    avgBookLength,
    totalWordsEstimate,
    pagesPerDay,
    wordsPerDay,
    goal,
    projection,
    pastYearVerdict,
    formatSplit: { physical, audio, hasSplitData: scopedFormatRows.length > 0 },
  };
}
