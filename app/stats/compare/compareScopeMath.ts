import { computeProjectionSeries, computeScopeData, scopeDateRange, buildYearSeriesByDayOfYear } from "../statsMath";
import type { BookSummary, DailyRow, FormatDailyRow, Goal, Scope, ScopeData } from "../types";

// A comparison "combatant" -- either a real scope (year/all-time, same
// shape /stats already uses) or a year's own end-of-year projection. The
// projection option is only ever offered for the current, still-in-
// progress year -- for any completed year the projection formula
// trivially reproduces the actual final total, so it'd be a redundant
// picker entry for anything else.
export type CompareScope = { kind: "year"; year: number } | { kind: "all" } | { kind: "projection"; year: number };

export type ProjectedTotals = { books: number; pages: number; words: number; pagesPerDay: number; wordsPerDay: number };

export type CompareScopeData = {
  scope: CompareScope;
  label: string;
  // Real computeScopeData() output for year/all-time; null for a
  // projection, which has no actual date range of its own to report.
  scopeData: ScopeData | null;
  // The books actually finished within scope -- [] for a projection,
  // since a projection has no real books, only a hypothetical total.
  books: BookSummary[];
  projected: ProjectedTotals | null;
};

export function booksInScope(books: BookSummary[], scope: Scope, today: string, currentYear: number): BookSummary[] {
  const { start, end } = scopeDateRange(scope, today, currentYear);
  return books.filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end);
}

export type ScopeInputs = {
  dailyRows: DailyRow[];
  formatDailyRows: FormatDailyRow[];
  books: BookSummary[];
  goals: Goal[];
  today: string;
  currentYear: number;
};

// Scales the target year's actual-so-far rates out to a full 365 days --
// pagesPerDay/wordsPerDay from computeScopeData are already adjusted for
// the "today probably isn't logged yet" edge case (see statsMath.ts's
// averagingDays), so multiplying by 365 directly is the same math
// computeProjectionSeries applies per-day, just applied to the scalar
// totals instead of a curve. Books don't have their own day-rate field on
// ScopeData, so that one estimate uses totalDays directly instead.
function projectYear(year: number, inputs: ScopeInputs): ProjectedTotals {
  const actual = computeScopeData({ scope: { kind: "year", year }, ...inputs });
  return {
    books: Math.round((actual.booksFinished * 365) / Math.max(1, actual.totalDays)),
    pages: Math.round(actual.pagesPerDay * 365),
    words: Math.round(actual.wordsPerDay * 365),
    pagesPerDay: actual.pagesPerDay,
    wordsPerDay: actual.wordsPerDay,
  };
}

export function resolveCompareScope(scope: CompareScope, inputs: ScopeInputs): CompareScopeData {
  if (scope.kind === "projection") {
    return { scope, label: `${scope.year} (projected)`, scopeData: null, books: [], projected: projectYear(scope.year, inputs) };
  }
  const realScope: Scope = scope.kind === "all" ? { kind: "all" } : { kind: "year", year: scope.year };
  const scopeData = computeScopeData({ scope: realScope, ...inputs });
  const books = booksInScope(inputs.books, realScope, inputs.today, inputs.currentYear);
  const label = scope.kind === "all" ? "All-time" : String(scope.year);
  return { scope, label, scopeData, books, projected: null };
}

// The race chart's cumulative-pages-by-day-of-year line for one combatant.
// Year -> its real curve. Projection -> the exact same smooth per-day
// projection curve computeProjectionSeries already builds for the prior-
// year overlay feature, reused verbatim. All-time -> a day-of-year axis
// doesn't fit multi-year data, so it renders as a straight reference line
// at its own all-time average pace extended across 365 days ("race this
// year against your typical pace"), not a fabricated multi-year curve.
export function raceSeriesFor(
  data: CompareScopeData,
  dailyRows: DailyRow[],
  today: string,
  currentYear: number
): { x: number; y: number }[] {
  if (data.scope.kind === "year") return buildYearSeriesByDayOfYear(dailyRows, data.scope.year);
  if (data.scope.kind === "projection") {
    const series = computeProjectionSeries(dailyRows, [data.scope.year], currentYear, today, {
      kind: "year",
      year: data.scope.year,
    });
    return series[0]?.points ?? [];
  }
  const rate = data.scopeData?.pagesPerDay ?? 0;
  return [
    { x: 0, y: 0 },
    { x: 365, y: rate * 365 },
  ];
}
