import { daysBetweenInclusive } from "../shared/isoDate";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { scopeDateRange } from "./statsMath";
import type { BookSummary, Scope } from "./types";

export type Bucket = {
  key: string;
  label: string;
  count: number;
  pages: number;
  words: number;
  books: BookSummary[];
};

function makeBucket(key: string, label: string): Bucket {
  return { key, label, count: 0, pages: 0, words: 0, books: [] };
}

function addToBucket(bucket: Bucket, book: BookSummary) {
  bucket.count++;
  bucket.pages += book.page_count;
  if (book.word_count != null) bucket.words += book.word_count;
  bucket.books.push(book);
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------- 1. Score histogram ----------

export const SCORE_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export type ScoreHistogram = {
  buckets: Bucket[];
  excluded: number;
  mean: number | null;
  median: number | null;
  mode: number | null;
};

export function computeScoreHistogram(books: BookSummary[]): ScoreHistogram {
  const scored = books.filter((b) => b.score != null);
  const buckets = SCORE_STEPS.map((s) => makeBucket(String(s), s.toFixed(1)));
  for (const b of scored) {
    const idx = SCORE_STEPS.findIndex((s) => Math.abs(s - (b.score as number)) < 0.001);
    if (idx >= 0) addToBucket(buckets[idx], b);
  }
  const scores = scored.map((b) => b.score as number);
  let modeIdx = 0;
  buckets.forEach((b, i) => {
    if (b.count > buckets[modeIdx].count) modeIdx = i;
  });
  return {
    buckets,
    excluded: books.length - scored.length,
    mean: mean(scores),
    median: median(scores),
    mode: scores.length > 0 ? SCORE_STEPS[modeIdx] : null,
  };
}

// Fractional bucket-index position for a raw value, for rendering a marker
// line over evenly-spaced buckets (e.g. mean=3.72 over 0.5-step buckets ->
// lands between the 3.5 and 4.0 bars).
export function markerPosition(value: number, steps: number[]): number {
  const stepSize = steps[1] - steps[0];
  return (value - steps[0]) / stepSize;
}

// ---------- 2. Book length ----------

type RangeDef = { max: number; label: string };

const WORD_LENGTH_BUCKETS: RangeDef[] = [
  { max: 50_000, label: "<50k" },
  { max: 100_000, label: "50-100k" },
  { max: 150_000, label: "100-150k" },
  { max: 200_000, label: "150-200k" },
  { max: 300_000, label: "200-300k" },
  { max: Infinity, label: "300k+" },
];

const PAGE_LENGTH_BUCKETS: RangeDef[] = [
  { max: 200, label: "<200" },
  { max: 350, label: "200-350" },
  { max: 500, label: "350-500" },
  { max: 650, label: "500-650" },
  { max: 900, label: "650-900" },
  { max: Infinity, label: "900+" },
];

function bucketDefFor(value: number, defs: RangeDef[]): RangeDef {
  return defs.find((d) => value < d.max) ?? defs[defs.length - 1];
}

export type LengthHistogram = {
  buckets: Bucket[];
  excluded: number;
  mean: number | null;
  shortest: BookSummary | null;
  longest: BookSummary | null;
};

export function computeLengthHistogram(books: BookSummary[], mode: "words" | "pages"): LengthHistogram {
  const defs = mode === "words" ? WORD_LENGTH_BUCKETS : PAGE_LENGTH_BUCKETS;
  const relevant = mode === "words" ? books.filter((b) => b.word_count != null) : books;
  const buckets = defs.map((d) => makeBucket(d.label, d.label));
  const byLabel = new Map(buckets.map((b) => [b.key, b]));
  const valueOf = (b: BookSummary) => (mode === "words" ? (b.word_count as number) : b.page_count);

  for (const b of relevant) {
    const def = bucketDefFor(valueOf(b), defs);
    addToBucket(byLabel.get(def.label)!, b);
  }

  let shortest: BookSummary | null = null;
  let longest: BookSummary | null = null;
  for (const b of relevant) {
    if (!shortest || valueOf(b) < valueOf(shortest)) shortest = b;
    if (!longest || valueOf(b) > valueOf(longest)) longest = b;
  }

  return {
    buckets,
    excluded: books.length - relevant.length,
    mean: mean(relevant.map(valueOf)),
    shortest,
    longest,
  };
}

// ---------- 3. Genre split ----------

export function computeGenreSplit(books: BookSummary[], allGenres: string[]): { buckets: Bucket[]; excluded: number } {
  const buckets = allGenres.map((g) => makeBucket(g, g));
  const byName = new Map(buckets.map((b) => [b.key, b]));
  let excluded = 0;
  for (const b of books) {
    const bucket = b.genre ? byName.get(b.genre) : undefined;
    if (!bucket) {
      excluded++;
      continue;
    }
    addToBucket(bucket, b);
  }
  buckets.sort((a, b) => b.count - a.count);
  return { buckets, excluded };
}

// ---------- 4. Format split ----------

const FORMAT_KEYS = ["physical", "audio", "ebook"];

export function computeFormatSplit(books: BookSummary[]): { buckets: Bucket[]; excluded: number } {
  const buckets = FORMAT_KEYS.map((f) => makeBucket(f, FORMAT_LABELS[f] ?? f));
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  let excluded = 0;
  for (const b of books) {
    const bucket = b.format_type ? byKey.get(b.format_type) : undefined;
    if (!bucket) {
      excluded++;
      continue;
    }
    addToBucket(bucket, b);
  }
  return { buckets, excluded };
}

// ---------- 5. Publication era ----------

function eraLabel(year: number): string {
  if (year < 1900) return "Pre-1900";
  if (year >= 2020) return String(year);
  return `${Math.floor(year / 10) * 10}s`;
}

// Pre-1900 sorts first (0); "1990s" and "2023" both parse as their leading
// number, which is already the correct chronological order.
function eraSortKey(label: string): number {
  return label === "Pre-1900" ? 0 : parseInt(label, 10);
}

export function computePublicationEra(books: BookSummary[]): { buckets: Bucket[]; excluded: number } {
  const withYear = books.filter((b) => b.year_released != null);
  const byLabel = new Map<string, Bucket>();
  for (const b of withYear) {
    const label = eraLabel(b.year_released as number);
    if (!byLabel.has(label)) byLabel.set(label, makeBucket(label, label));
    addToBucket(byLabel.get(label)!, b);
  }
  const buckets = Array.from(byLabel.values()).sort((a, b) => eraSortKey(a.label) - eraSortKey(b.label));
  return { buckets, excluded: books.length - withYear.length };
}

// ---------- 6. Reading pace distribution ----------

const PACE_BUCKETS: RangeDef[] = [
  { max: 20, label: "<20" },
  { max: 40, label: "20-40" },
  { max: 60, label: "40-60" },
  { max: 80, label: "60-80" },
  { max: 100, label: "80-100" },
  { max: Infinity, label: "100+" },
];

export function computePaceHistogram(books: BookSummary[]): { buckets: Bucket[]; excluded: number; mean: number | null } {
  const withPace = books.filter((b) => b.avg_pages_per_day != null);
  const buckets = PACE_BUCKETS.map((d) => makeBucket(d.label, d.label));
  const byLabel = new Map(buckets.map((b) => [b.key, b]));
  for (const b of withPace) {
    const def = bucketDefFor(b.avg_pages_per_day as number, PACE_BUCKETS);
    addToBucket(byLabel.get(def.label)!, b);
  }
  return {
    buckets,
    excluded: books.length - withPace.length,
    mean: mean(withPace.map((b) => b.avg_pages_per_day as number)),
  };
}

// ---------- 7. Days-to-finish distribution ----------

const DAYS_BUCKETS: RangeDef[] = [
  { max: 3, label: "1-3" },
  { max: 7, label: "4-7" },
  { max: 14, label: "8-14" },
  { max: 30, label: "15-30" },
  { max: Infinity, label: "30+" },
];

export function computeDaysToFinishHistogram(books: BookSummary[]): { buckets: Bucket[]; excluded: number } {
  const withDates = books.filter((b) => b.date_started && b.date_finished);
  const buckets = DAYS_BUCKETS.map((d) => makeBucket(d.label, d.label));
  const byLabel = new Map(buckets.map((b) => [b.key, b]));
  for (const b of withDates) {
    const days = daysBetweenInclusive(b.date_started as string, b.date_finished as string);
    const def = bucketDefFor(days, DAYS_BUCKETS);
    addToBucket(byLabel.get(def.label)!, b);
  }
  return { buckets, excluded: books.length - withDates.length };
}

// ---------- 8. Monthly buckets (books finished / pages read per month) ----------

// Year scope -> that year's 12 months; all-time -> every (year, month) from
// 2023-01 through the current month. Both Books-finished-per-month and
// Pages-per-month read from this same bucket set (count/pages are already
// tracked per bucket via addToBucket) so the two never disagree. Used by
// MonthlyVolumeSection (a bigger standalone chart, not a DistributionCard).
export function computeMonthlyBuckets(
  books: BookSummary[],
  scope: Scope,
  today: string,
  currentYear: number
): { buckets: Bucket[]; excluded: number } {
  const { start, end } = scopeDateRange(scope, today, currentYear);
  const startYear = Number(start.slice(0, 4));
  const startMonth = Number(start.slice(5, 7));
  const endYear = Number(end.slice(0, 4));
  const endMonth = Number(end.slice(5, 7));

  const months: { year: number; month: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 1;
    const mEnd = y === endYear ? endMonth : 12;
    for (let m = mStart; m <= mEnd; m++) months.push({ year: y, month: m });
  }

  const singleYear = scope.kind === "year";
  const buckets = months.map(({ year, month }) => {
    const label = singleYear
      ? MONTH_LABELS[month - 1]
      : `${MONTH_LABELS[month - 1]} ${String(year).slice(2)}`;
    return makeBucket(`${year}-${String(month).padStart(2, "0")}`, label);
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  const withDate = books.filter((b) => b.date_finished != null && b.date_finished >= start && b.date_finished <= end);
  for (const b of withDate) {
    const key = (b.date_finished as string).slice(0, 7);
    const bucket = byKey.get(key);
    if (bucket) addToBucket(bucket, b);
  }
  return { buckets, excluded: books.length - withDate.length };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
