import { ordinal } from "../books/[id]/format";
import { daysBetweenInclusive } from "../shared/isoDate";
import { FORMAT_LABELS } from "../shared/formatLabels";
import type { BookSummary, SeriesParent } from "./types";

// Author name -> author_id, for linking an AuthorName rendered from a
// grouped leaderboard entry (which only ever has the name string, not the id).
export function buildAuthorIdMap(books: BookSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of books) {
    if (b.author_id != null && !map.has(b.author)) map.set(b.author, b.author_id);
  }
  return map;
}

export type MetricKey = "pages" | "words" | "books" | "avgScore" | "avgPercentile";

export const METRICS: MetricKey[] = ["pages", "words", "books", "avgScore", "avgPercentile"];

export const METRIC_LABELS: Record<MetricKey, string> = {
  pages: "Pages",
  words: "Words",
  books: "Books",
  avgScore: "Avg score",
  avgPercentile: "Consistency",
};

export type LeaderboardEntry = {
  name: string;
  bookId?: number;
  primaryLabel: string;
  secondaryLabel: string;
  sortValue: number;
  // Only populated for avgScore -- breaks ties in average rating by average
  // percentile (see the author dossier page's getRankByScore for the same
  // convention). Unused by every other metric.
  tiebreak?: number;
};

function fmtPages(n: number): string {
  return `${Math.round(n).toLocaleString()} pages`;
}
function fmtWords(n: number): string {
  return `${Math.round(n).toLocaleString()} words`;
}
function fmtBooks(n: number): string {
  return `${n} book${n === 1 ? "" : "s"}`;
}
function fmtScore(n: number): string {
  return `${n.toFixed(2)} avg`;
}
// Deliberately "Nth percentile" phrasing (100th = best), not "top X%" --
// higher number always means better here, matching how percentile rank
// conventionally reads (90th percentile = better than 90% of everyone).
function fmtPercentile(n: number): string {
  return `${ordinal(Math.round(n * 100))} percentile avg`;
}

type Group = { name: string; books: BookSummary[] };

// Each metric is computed from only the books that actually have the field
// it needs -- a group missing that data entirely is left out of the metric,
// not shown with a misleading zero.
function buildEntriesForMetric(groups: Group[], metric: MetricKey, minSampleBooks: number): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  for (const g of groups) {
    const books = g.books;
    if (books.length === 0) continue;

    if (metric === "pages") {
      const total = books.reduce((sum, b) => sum + b.page_count, 0);
      if (total <= 0) continue;
      entries.push({ name: g.name, primaryLabel: fmtPages(total), secondaryLabel: fmtBooks(books.length), sortValue: total });
    } else if (metric === "words") {
      const withWords = books.filter((b) => b.word_count != null);
      if (withWords.length === 0) continue;
      const total = withWords.reduce((sum, b) => sum + (b.word_count as number), 0);
      entries.push({ name: g.name, primaryLabel: fmtWords(total), secondaryLabel: fmtBooks(books.length), sortValue: total });
    } else if (metric === "books") {
      const totalPages = books.reduce((sum, b) => sum + b.page_count, 0);
      entries.push({ name: g.name, primaryLabel: fmtBooks(books.length), secondaryLabel: fmtPages(totalPages), sortValue: books.length });
    } else if (metric === "avgScore") {
      // The min-books threshold gates on the group's real book count (what
      // "2+ books" actually means), not on how many of those happen to have
      // a score -- otherwise an author with 2 real books but only 1 scored
      // one (e.g. a book finished before scoring existed) reads as having
      // just 1 book and gets dropped by a filter that's supposed to be about
      // their total output, not this metric's data completeness.
      if (books.length < minSampleBooks) continue;
      const scored = books.filter((b) => b.score != null);
      if (scored.length === 0) continue;
      const avg = scored.reduce((sum, b) => sum + (b.score as number), 0) / scored.length;
      // Tie-break: avg percentile across whichever of the group's books have
      // been ranked (same "average only over ranked books" rule as the
      // Consistency metric below) -- -1 for groups with no ranked books at
      // all, so they sort after anyone with real percentile data on a tie.
      const ranked = books.filter((b) => b.percentile != null);
      const tiebreak =
        ranked.length > 0 ? ranked.reduce((sum, b) => sum + (b.percentile as number), 0) / ranked.length : -1;
      entries.push({
        name: g.name,
        primaryLabel: fmtScore(avg),
        secondaryLabel: fmtBooks(scored.length),
        sortValue: avg,
        tiebreak,
      });
    } else {
      // Raw rank position isn't comparable across years (rank 36 of 58 vs
      // rank 1 of 10 aren't the same "good"), so this averages each book's
      // percentile within its own year's ranked list instead. Same
      // total-vs-subset distinction as avgScore above: eligibility is based
      // on real book count, the average itself only over the ranked subset.
      if (books.length < minSampleBooks) continue;
      const ranked = books.filter((b) => b.percentile != null);
      if (ranked.length === 0) continue;
      const avg = ranked.reduce((sum, b) => sum + (b.percentile as number), 0) / ranked.length;
      entries.push({ name: g.name, primaryLabel: fmtPercentile(avg), secondaryLabel: fmtBooks(ranked.length), sortValue: avg });
    }
  }

  entries.sort((a, b) => b.sortValue - a.sortValue || (b.tiebreak ?? 0) - (a.tiebreak ?? 0));
  return entries;
}

// Groups books by an arbitrary flat key (author, genre, subgenre, format,
// narrator, decade published, year read, ...) -- anything that isn't a
// hierarchy. Series is the one exception (see computeSeriesLeaderboards),
// since it needs the parent-chain rollup below.
export function computeFlatLeaderboards(
  books: BookSummary[],
  keyFn: (b: BookSummary) => string | null,
  minBooksForAvg: number
): Record<MetricKey, LeaderboardEntry[]> {
  const byKey = new Map<string, BookSummary[]>();
  for (const b of books) {
    const key = keyFn(b);
    if (key == null) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(b);
  }
  const groups: Group[] = Array.from(byKey.entries()).map(([name, bks]) => ({ name, books: bks }));

  return {
    pages: buildEntriesForMetric(groups, "pages", 1),
    words: buildEntriesForMetric(groups, "words", 1),
    books: buildEntriesForMetric(groups, "books", 1),
    avgScore: buildEntriesForMetric(groups, "avgScore", minBooksForAvg),
    avgPercentile: buildEntriesForMetric(groups, "avgPercentile", minBooksForAvg),
  };
}

// A book counts toward its own series AND every series up the parent chain
// (Alloy of Law -> Mistborn Era 2 -> Mistborn -> Cosmere), so a top-level
// rollup like Cosmere aggregates everything beneath it. Cycle-guarded since
// parent_series has no DB constraint stopping one.
function seriesChain(series: string, parentMap: Map<string, string | null>): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = series;
  while (current && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = parentMap.get(current) ?? null;
  }
  return chain;
}

export type SeriesLevelFilter = "all" | "main" | "sub";

export function computeSeriesLeaderboards(
  books: BookSummary[],
  seriesParents: SeriesParent[],
  minBooksForAvg: number = 1,
  levelFilter: SeriesLevelFilter = "all"
): Record<MetricKey, LeaderboardEntry[]> {
  const parentMap = new Map(seriesParents.map((s) => [s.series, s.parent_series]));
  const bySeriesName = new Map<string, BookSummary[]>();

  function ensure(name: string): BookSummary[] {
    if (!bySeriesName.has(name)) bySeriesName.set(name, []);
    return bySeriesName.get(name) as BookSummary[];
  }

  // Seed every known series name so a pure rollup parent (no book is ever
  // tagged with "Cosmere" directly, say) still appears once its descendants
  // are credited to it below.
  for (const s of seriesParents) ensure(s.series);

  for (const b of books) {
    if (!b.series) continue;
    for (const name of seriesChain(b.series, parentMap)) ensure(name).push(b);
  }

  // A book under a subseries counts toward both the subseries AND its
  // parent rollup (e.g. a "Death" book counts for "Death" and "Discworld"),
  // so the same book is deliberately double-counted across levels. "Main"
  // keeps only series with no parent of their own (standalone series, and
  // top-level rollups like Discworld); "Sub" keeps only series that
  // themselves roll up into something else.
  function isSub(name: string): boolean {
    return parentMap.get(name) != null;
  }

  let groups: Group[] = Array.from(bySeriesName.entries()).map(([name, bks]) => ({ name, books: bks }));
  if (levelFilter === "main") groups = groups.filter((g) => !isSub(g.name));
  else if (levelFilter === "sub") groups = groups.filter((g) => isSub(g.name));

  return {
    pages: buildEntriesForMetric(groups, "pages", 1),
    words: buildEntriesForMetric(groups, "words", 1),
    books: buildEntriesForMetric(groups, "books", 1),
    avgScore: buildEntriesForMetric(groups, "avgScore", minBooksForAvg),
    avgPercentile: buildEntriesForMetric(groups, "avgPercentile", minBooksForAvg),
  };
}

export type BookFormatFilter = "all" | "physical" | "audio";

// "Physical" includes ebook -- eye-reading a screen paces like a printed
// page, not like an audiobook, so ebook is grouped with physical rather
// than held out as a third bucket here.
function matchesFormatFilter(formatType: string | null, filter: BookFormatFilter): boolean {
  if (filter === "all") return true;
  if (filter === "physical") return formatType === "physical" || formatType === "ebook";
  return formatType === "audio";
}

// Fastest-to-slowest individual books by pages/day -- uses the tracked
// avg_pages_per_day directly (from the reading spreadsheet) rather than
// deriving it from date_started/date_finished. Those dates were themselves
// computed FROM that tracked figure for most books (see
// scripts/backfill-date-started.ts), so dividing page_count back out of
// them just reintroduces the rounding that math already went through --
// confirmed materially wrong for several books (e.g. Crossroads of Ravens:
// derived 76.8 pg/day vs the tracked 96). Books with no tracked figure are
// excluded, not shown with a derived-and-possibly-wrong number.
export function computeBookPaceLeaderboard(
  books: BookSummary[],
  formatFilter: BookFormatFilter
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  for (const b of books) {
    if (!matchesFormatFilter(b.format_type, formatFilter)) continue;
    if (b.avg_pages_per_day == null || b.avg_pages_per_day <= 0) continue;
    const pace = b.avg_pages_per_day;
    const formatLabel = b.format_type ? (FORMAT_LABELS[b.format_type] ?? b.format_type) : null;
    const days =
      b.date_started && b.date_finished ? daysBetweenInclusive(b.date_started, b.date_finished) : null;
    const secondaryParts = [days != null ? `${days} day${days === 1 ? "" : "s"}` : null, formatLabel].filter(
      Boolean
    );
    entries.push({
      name: b.title,
      bookId: b.book_id,
      primaryLabel: `${pace.toFixed(1)} pg/day`,
      secondaryLabel: secondaryParts.join(" · ") || "--",
      sortValue: pace,
    });
  }

  entries.sort((a, b) => b.sortValue - a.sortValue || (b.tiebreak ?? 0) - (a.tiebreak ?? 0));
  return entries;
}
