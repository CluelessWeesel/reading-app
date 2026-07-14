import { daysBetweenInclusive } from "../shared/isoDate";
import { scopeDateRange } from "./statsMath";
import type { BookSummary, Scope } from "./types";

export const PUBLICATION_YEAR_FLOOR = 1800;

type BasePoint = {
  bookId: number;
  title: string;
  author: string | null;
  coverUrl: string | null;
  x: number; // day offset from the domain's start date
};

export type PublicationScatterPoint = BasePoint & {
  yTrue: number; // real year_released
  yClamped: number; // max(yTrue, PUBLICATION_YEAR_FLOOR)
  pinned: boolean; // true if yTrue < PUBLICATION_YEAR_FLOOR (floor-pinned)
};

// scopeDateRange's "all" start (2023-01-01) is right for the pace chart
// (daily_reading tracking didn't exist earlier) but wrong here -- a handful
// of books have a date_finished before that from the historical import, and
// the scatter's whole point is date_finished on the X-axis, so those need
// to actually appear rather than being silently clipped out of the domain.
export function computePublicationScatterPoints(
  books: BookSummary[],
  scope: Scope,
  today: string,
  currentYear: number
): { points: PublicationScatterPoint[]; excluded: number; domainMaxX: number; start: string; end: string; maxYear: number } {
  const withYear = books.filter((b) => b.date_finished != null && b.year_released != null);

  const { start: scopeStart, end } =
    scope.kind === "year"
      ? scopeDateRange(scope, today, currentYear)
      : { start: withYear.reduce((min, b) => (b.date_finished! < min ? b.date_finished! : min), today), end: today };

  const domainMaxX = Math.max(1, daysBetweenInclusive(scopeStart, end) - 1);
  const maxYear = Math.max(currentYear, ...withYear.map((b) => b.year_released as number));

  const points: PublicationScatterPoint[] = withYear.map((b) => {
    const yTrue = b.year_released as number;
    return {
      bookId: b.book_id,
      title: b.title,
      author: b.author,
      coverUrl: b.cover_url,
      x: daysBetweenInclusive(scopeStart, b.date_finished as string) - 1,
      yTrue,
      yClamped: Math.max(yTrue, PUBLICATION_YEAR_FLOOR),
      pinned: yTrue < PUBLICATION_YEAR_FLOOR,
    };
  });

  return { points, excluded: books.length - withYear.length, domainMaxX, start: scopeStart, end, maxYear };
}

export type PagesPerDayLinePoint = BasePoint & {
  value: number; // avg_pages_per_day
};

// Two independent series (physical, audio) -- X is each book's sequential
// position in reading order within its own format (0, 1, 2, ...), not a
// date, so the two series naturally zigzag at their own pace regardless of
// how far apart in time consecutive books were actually finished. Y is
// avg_pages_per_day (the "Avg Pages/Day Avg Book" / column M metric).
// `books` is expected to already be scope-filtered by the caller (same
// convention as every other section) -- "every book" vs "just that year's
// books" falls out of whatever's passed in, no scope param needed here.
export function computePagesPerDaySeries(
  books: BookSummary[]
): { physical: PagesPerDayLinePoint[]; audio: PagesPerDayLinePoint[]; excluded: number; maxValue: number } {
  const eligible = books.filter(
    (b) => b.date_finished != null && b.avg_pages_per_day != null && (b.format_type === "physical" || b.format_type === "ebook" || b.format_type === "audio")
  );
  const sorted = [...eligible].sort((a, b) => (a.date_finished! < b.date_finished! ? -1 : a.date_finished! > b.date_finished! ? 1 : 0));

  const physical: PagesPerDayLinePoint[] = [];
  const audio: PagesPerDayLinePoint[] = [];
  for (const b of sorted) {
    const point: PagesPerDayLinePoint = {
      bookId: b.book_id,
      title: b.title,
      author: b.author,
      coverUrl: b.cover_url,
      x: 0,
      value: b.avg_pages_per_day as number,
    };
    // "Physical" includes ebook too, matching the same rule used everywhere
    // else on this page (statsMath.ts's formatSplit, PaceSection).
    (b.format_type === "audio" ? audio : physical).push(point);
  }
  physical.forEach((p, i) => (p.x = i));
  audio.forEach((p, i) => (p.x = i));

  const withFinishDate = books.filter((b) => b.date_finished != null);
  const maxValue = Math.max(1, ...eligible.map((b) => b.avg_pages_per_day as number));

  return { physical, audio, excluded: withFinishDate.length - eligible.length, maxValue };
}

// General-purpose "nice round number" axis step, for any numeric Y-range
// that isn't the publication-year floor case (which has its own fixed-step
// ladder above since 1800 is a meaningful constant, not just a data min).
export function computeNiceGridlines(maxValue: number, minValue = 0): number[] {
  const range = Math.max(1, maxValue - minValue);
  const rough = range / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  const lines: number[] = [];
  for (let v = minValue; v < maxValue; v += step) lines.push(Math.round(v * 100) / 100);
  lines.push(Math.round(maxValue * 100) / 100);
  return lines;
}

// Nice round year marks for horizontal gridlines, spaced further apart as
// the domain gets wider so the chart doesn't get cluttered.
export function computeYGridlines(maxYear: number): number[] {
  const range = maxYear - PUBLICATION_YEAR_FLOOR;
  const step = range <= 60 ? 10 : range <= 120 ? 25 : range <= 260 ? 50 : 100;
  const lines: number[] = [];
  for (let y = PUBLICATION_YEAR_FLOOR; y < maxYear; y += step) lines.push(y);
  lines.push(maxYear);
  return lines;
}

// Vertical gridlines for date reference: quarter boundaries in year scope,
// calendar-year boundaries in all-time scope. x is a day-offset from start,
// matching ScatterPoint.x's own convention.
export function computeXGridlines(scope: Scope, start: string, end: string): { x: number; label: string }[] {
  if (scope.kind === "year") {
    const year = scope.year;
    const quarters = [
      { date: `${year}-01-01`, label: "Jan" },
      { date: `${year}-04-01`, label: "Apr" },
      { date: `${year}-07-01`, label: "Jul" },
      { date: `${year}-10-01`, label: "Oct" },
    ];
    return quarters
      .filter((q) => q.date >= start && q.date <= end)
      .map((q) => ({ x: daysBetweenInclusive(start, q.date) - 1, label: q.label }));
  }
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const lines: { x: number; label: string }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const jan1 = `${y}-01-01`;
    if (jan1 >= start && jan1 <= end) lines.push({ x: daysBetweenInclusive(start, jan1) - 1, label: String(y) });
  }
  return lines;
}

// Deterministic per-book jitter (not Math.random -- points must not shift
// between reloads) so dense clusters (many books published the same year,
// or finished close together) don't fully overlap. Classic sine-hash trick,
// stable and cheap; returns a pair in [-1, 1].
export function jitterFor(bookId: number): { dx: number; dy: number } {
  const h1 = Math.sin(bookId * 12.9898) * 43758.5453;
  const h2 = Math.sin(bookId * 78.233) * 43758.5453;
  return { dx: (h1 - Math.floor(h1)) * 2 - 1, dy: (h2 - Math.floor(h2)) * 2 - 1 };
}
