import { daysBetweenInclusive, addIsoDays } from "../shared/isoDate";
import { AVG_WORDS_PER_PAGE } from "../shared/avgPagesPerDay";
import { buildYearSeriesByDayOfYear } from "../stats/statsMath";
import { computeFlatLeaderboards, computeBookPaceLeaderboard } from "../stats/leaderboardMath";
import { RECORD_GROUPS } from "../stats/recordsMath";
import type { RecordContext } from "../stats/recordsMath";
import type { BookSummary, DailyRow, FormatDailyRow } from "../stats/types";
import { APP_START_YEAR } from "./recapMath";
import type {
  AuthorOfYearCardData,
  ColdOpenCardData,
  DevouringCardData,
  EpitaphCardData,
  GenreMapCardData,
  OdometerTurnCardData,
  PerfectScoresCardData,
  PodiumCardData,
  PodiumEntry,
  PredictionReportCardData,
  RecordStampEntry,
  RivalVerdictCardData,
  RivalYearBar,
  ScaleCardData,
  StoryCardData,
  YearShapeCardData,
} from "./types";

// Same "app started tracking in 2023" floor used by the recap engine --
// Wrapped never covers an earlier year, so no backfill below this exists.
export { APP_START_YEAR };

// The full BookSummary shape (see app/stats/types.ts) plus predicted_score,
// which BookSummary doesn't carry -- fetched fresh for Wrapped rather than
// reusing stats/page.tsx's getBooks() so this file owns its own query. Kept
// structurally compatible with BookSummary on purpose: RECORD_GROUPS and
// leaderboardMath both type their inputs as BookSummary[], and a superset
// object satisfies that without any mapping/casting at the call site.
export type WrappedBook = BookSummary & { predicted_score: number | null };

export type WrappedRankingRow = { book_id: number; year: number; rank: number };
export type WeeselWinnerRow = { book_id: number; year: number; category: string };
export type FiveWordAnswer = { book_id: number; answer: string };

export type WrappedContext = {
  books: WrappedBook[]; // all-time
  dailyRows: DailyRow[]; // all-time, sparse
  formatDailyRows: FormatDailyRow[]; // all-time, sparse
  rankings: WrappedRankingRow[]; // all-time, book_rankings
  weeselWinners: WeeselWinnerRow[]; // all-time, result = 'winner' only
  sealedYears: Set<number>;
  authorPhotoMap: Map<number, string | null>; // author_id -> photo_url
  fiveWordAnswers: FiveWordAnswer[]; // all-time, prompt "Describe the book in 5 words"
};

function yearBooks(books: WrappedBook[], year: number): WrappedBook[] {
  return books.filter((b) => b.date_finished != null && b.date_finished.slice(0, 4) === String(year));
}

// Simple rate-based projection (actual-so-far * 365/dayOfYear) -- the same
// shape as statsMath's computeProjectionSeries, just collapsed to a single
// end-of-year figure instead of a whole curve. Deliberately ungated by any
// reading goal (unlike ScopeData.projection, which only exists when a goal
// is set) since Wrapped's cold-open/scale numbers need to project either way.
function projectToYearEnd(actualSoFar: number, dayOfYear: number): number {
  return (actualSoFar * 365) / dayOfYear;
}

// Reading almost always gets logged at the end of the day, not throughout
// it, so counting today as a full elapsed day (dividing by it) before it's
// had any real chance of a row systematically understates the projection
// right up until today's pages actually land -- same reasoning as stats'
// averagingDays. Once a row for today exists (even a logged zero), it
// counts like any other day.
function projectionDayOfYear(rawDayOfYear: number, today: string, dailyRows: DailyRow[]): number {
  const todayLogged = dailyRows.some((r) => r.date === today);
  return todayLogged ? rawDayOfYear : Math.max(1, rawDayOfYear - 1);
}

function pagesForYear(dailyRows: DailyRow[], year: number): number {
  return dailyRows.filter((r) => r.date.slice(0, 4) === String(year)).reduce((sum, r) => sum + r.pages, 0);
}

// Same "best-scored first" splay as the original generic Hero card and the
// recap header -- a visual reminder of what the year actually held before
// any numbers get named.
function topCoversForYear(books: WrappedBook[], year: number, limit = 5): string[] {
  return yearBooks(books, year)
    .filter((b) => b.cover_url)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
    .map((b) => b.cover_url as string);
}

// ---------- (1) Cold open ----------

export function computeColdOpen(
  books: WrappedBook[],
  dailyRows: DailyRow[],
  year: number,
  isFinal: boolean,
  dayOfYear: number
): ColdOpenCardData {
  const actualPages = pagesForYear(dailyRows, year);
  const actualBooks = yearBooks(books, year).length;
  const pages = isFinal ? actualPages : projectToYearEnd(actualPages, dayOfYear);
  const bookCount = isFinal ? actualBooks : projectToYearEnd(actualBooks, dayOfYear);
  return {
    type: "cold-open",
    year,
    books: Math.round(bookCount),
    pages: Math.round(pages),
    words: Math.round(pages * AVG_WORDS_PER_PAGE),
    coverUrls: topCoversForYear(books, year),
  };
}

// ---------- (2) The scale ----------

// A leaf of a typical finished paperback page runs close to 0.1mm --
// illustrative, not a claim about any specific book's actual paper stock.
const PAGE_THICKNESS_METERS = 0.0001;

const LANDMARKS: { name: string; heightMeters: number }[] = [
  { name: "the Leaning Tower of Pisa", heightMeters: 56 },
  { name: "the Statue of Liberty", heightMeters: 93 },
  { name: "Big Ben", heightMeters: 96 },
  { name: "the Eiffel Tower", heightMeters: 330 },
  { name: "the Empire State Building", heightMeters: 443 },
  { name: "the Burj Khalifa", heightMeters: 828 },
  { name: "Mount Everest", heightMeters: 8849 },
];

// The tallest landmark the stack actually clears; if it doesn't clear even
// the shortest one, that shortest landmark is still used with a sub-1 ratio
// ("38% of the way up the Leaning Tower of Pisa") rather than picking
// something so small the comparison stops meaning anything.
function pickLandmark(stackHeightMeters: number): { name: string; heightMeters: number } {
  for (let i = LANDMARKS.length - 1; i >= 0; i--) {
    if (stackHeightMeters >= LANDMARKS[i].heightMeters) return LANDMARKS[i];
  }
  return LANDMARKS[0];
}

// "Days of life read this year" reinterpreted as days with a real reading
// session this year, not literal age-in-days -- this app only stores a
// birthday as MM-DD (no birth year, see app/stats/RecordsSection.tsx), so an
// actual lifetime day-count isn't something the data can support.
export function computeScale(
  books: WrappedBook[],
  dailyRows: DailyRow[],
  year: number,
  isFinal: boolean,
  dayOfYear: number
): ScaleCardData {
  const actualPages = pagesForYear(dailyRows, year);
  const pages = Math.round(isFinal ? actualPages : projectToYearEnd(actualPages, dayOfYear));
  const stackHeightMeters = pages * PAGE_THICKNESS_METERS;
  const landmark = pickLandmark(stackHeightMeters);
  const readingDaysThisYear = dailyRows.filter((r) => r.date.slice(0, 4) === String(year) && r.pages > 0).length;
  return {
    type: "scale",
    pages,
    stackHeightMeters,
    landmarkName: landmark.name,
    landmarkHeightMeters: landmark.heightMeters,
    landmarkRatio: stackHeightMeters / landmark.heightMeters,
    readingDaysThisYear,
  };
}

// ---------- (3) The year's shape ----------

// Always the real logged data, never projected -- unlike the cold open and
// scale cards, a skyline of daily bars wouldn't mean anything drawn from a
// formula instead of what actually happened.
export function computeYearShape(dailyRows: DailyRow[], year: number, today: string): YearShapeCardData {
  const yearStart = `${year}-01-01`;
  const currentYear = Number(today.slice(0, 4));
  const yearEnd = year < currentYear ? `${year}-12-31` : today;
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  const bars: { date: string; pages: number }[] = [];
  let d = yearStart;
  while (d <= yearEnd) {
    bars.push({ date: d, pages: byDate.get(d) ?? 0 });
    d = addIsoDays(d, 1);
  }

  if (bars.every((b) => b.pages === 0)) {
    return { type: "year-shape", bars, bestDate: null, bestPages: 0, wryLine: "Not a page logged yet." };
  }

  const best = bars.reduce((a, b) => (b.pages > a.pages ? b : a));
  const quietDays = bars.filter((b) => b.pages === 0).length;
  const quietShare = quietDays / bars.length;
  const wryLine =
    quietShare >= 0.5
      ? `More quiet days than loud ones this year -- ${quietDays} without a page.`
      : quietShare >= 0.25
        ? `A few real quiet spells in there -- ${quietDays} days with nothing logged.`
        : `Mostly kept the habit -- only ${quietDays} silent days all year.`;

  return { type: "year-shape", bars, bestDate: best.date, bestPages: best.pages, wryLine };
}

// ---------- (4) The devouring ----------

export function computeDevouring(books: WrappedBook[], year: number): DevouringCardData | null {
  const finished = yearBooks(books, year);
  const top = computeBookPaceLeaderboard(finished, "all")[0];
  if (!top || top.bookId == null) return null;
  const book = finished.find((b) => b.book_id === top.bookId);
  if (!book) return null;
  const days =
    book.date_started && book.date_finished ? daysBetweenInclusive(book.date_started, book.date_finished) : null;

  // "Nx your average pace this year" -- compared against the year's own
  // typical book pace (the mean of every tracked avg_pages_per_day this
  // year), not the aggregate daily rate, so it reads as "this book vs a
  // normal book" rather than "this book vs your whole reading habit."
  const paceSamples = finished
    .map((b) => b.avg_pages_per_day)
    .filter((p): p is number => p != null && p > 0);
  const yearAvgPace = paceSamples.length > 0 ? paceSamples.reduce((s, v) => s + v, 0) / paceSamples.length : null;
  const vsYearAveragePace =
    yearAvgPace != null && yearAvgPace > 0 ? (book.avg_pages_per_day as number) / yearAvgPace : null;

  return {
    type: "devouring",
    bookId: book.book_id,
    title: book.title,
    coverUrl: book.cover_url,
    score: book.score,
    pagesPerDay: book.avg_pages_per_day as number,
    days,
    vsYearAveragePace,
  };
}

// ---------- (5) Author of the year ----------

export function computeAuthorOfYear(
  books: WrappedBook[],
  year: number,
  authorPhotoMap: Map<number, string | null>
): AuthorOfYearCardData | null {
  const finished = yearBooks(books, year);
  const top = computeFlatLeaderboards(finished, (b) => b.author, 1).pages[0];
  if (!top) return null;
  const runnerUpEntry = computeFlatLeaderboards(finished, (b) => b.author, 1).pages[1];

  const authorId = finished.find((b) => b.author === top.name)?.author_id ?? null;
  const runnerUp = runnerUpEntry
    ? {
        author: runnerUpEntry.name,
        authorId: finished.find((b) => b.author === runnerUpEntry.name)?.author_id ?? null,
        pages: runnerUpEntry.sortValue,
      }
    : null;

  return {
    type: "author-of-year",
    author: top.name,
    authorId,
    photoUrl: authorId != null ? (authorPhotoMap.get(authorId) ?? null) : null,
    pages: top.sortValue,
    books: finished.filter((b) => b.author === top.name).length,
    runnerUp,
  };
}

// ---------- (6) The genre map ----------

export function computeGenreMap(books: WrappedBook[], year: number): GenreMapCardData | null {
  const finished = yearBooks(books, year);
  const counts = new Map<string, number>();
  for (const b of finished) {
    if (!b.genre) continue;
    counts.set(b.genre, (counts.get(b.genre) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const slices = sorted.slice(0, 6).map(([genre, count]) => ({ genre, count, percent: (count / total) * 100 }));
  const [topGenre, topCount] = sorted[0];
  const topShare = topCount / total;

  // Era: is this the most-modern (or most-vintage) year yet, by average
  // year_released, among every year with at least one comparison point?
  const eraByYear = new Map<number, number[]>();
  for (const b of books) {
    if (!b.date_finished || b.year_released == null) continue;
    const y = Number(b.date_finished.slice(0, 4));
    if (!eraByYear.has(y)) eraByYear.set(y, []);
    eraByYear.get(y)!.push(b.year_released);
  }
  let diagnosis: string | null = null;
  const thisYearEra = eraByYear.get(year);
  if (thisYearEra && thisYearEra.length > 0 && eraByYear.size >= 2) {
    const avgOf = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length;
    const thisAvg = avgOf(thisYearEra);
    const otherAvgs = Array.from(eraByYear.entries())
      .filter(([y]) => y !== year)
      .map(([, arr]) => avgOf(arr));
    if (otherAvgs.length > 0 && otherAvgs.every((a) => thisAvg > a)) diagnosis = "Your most modern year yet";
    else if (otherAvgs.length > 0 && otherAvgs.every((a) => thisAvg < a)) diagnosis = "Your most vintage year yet";
  }

  // Genre: does this year hold the all-time-high share for its own
  // dominant genre?
  if (!diagnosis) {
    const years = new Set(books.filter((b) => b.date_finished).map((b) => Number((b.date_finished as string).slice(0, 4))));
    const shareByYear = new Map<number, number>();
    for (const y of years) {
      const yBooks = books.filter((b) => b.date_finished && Number(b.date_finished.slice(0, 4)) === y && b.genre);
      if (yBooks.length === 0) continue;
      shareByYear.set(y, yBooks.filter((b) => b.genre === topGenre).length / yBooks.length);
    }
    const thisShare = shareByYear.get(year) ?? topShare;
    const otherShares = Array.from(shareByYear.entries())
      .filter(([y]) => y !== year)
      .map(([, s]) => s);
    if (otherShares.length > 0 && otherShares.every((s) => thisShare > s)) {
      diagnosis = `Your most ${topGenre} year`;
    }
  }

  if (!diagnosis) {
    diagnosis =
      topShare >= 0.5
        ? `Heavy on ${topGenre} this year`
        : topShare >= 0.3
          ? `Leaning ${topGenre}, with a real mix`
          : "A genuinely balanced diet this year";
  }

  return { type: "genre-map", slices, diagnosis };
}

// ---------- (7) The perfect scores ----------

export function computePerfectScores(books: WrappedBook[], year: number): PerfectScoresCardData {
  const finished = yearBooks(books, year);
  const entries = finished
    .filter((b) => b.score === 5)
    .map((b) => ({ bookId: b.book_id, title: b.title, coverUrl: b.cover_url, author: b.author }));
  const droughtLine = entries.length === 0 ? `You gave zero perfect scores. ${year} never quite earned it.` : null;
  return { type: "perfect-scores", entries, droughtLine };
}

// ---------- (8) The podium ----------

// No single "Book of the Year" category exists in the Weesels schema (see
// weesel_categories) -- Novel of the Year and Non-Fiction of the Year are
// the two book-linked categories closest to that idea, so a sealed year's
// closing line prefers whichever of the two actually has a winner.
const BOTY_CATEGORY_PRIORITY = ["Novel of the Year", "Non-Fiction of the Year"];

export function computePodium(
  books: WrappedBook[],
  rankings: WrappedRankingRow[],
  weeselWinners: WeeselWinnerRow[],
  sealedYears: Set<number>,
  year: number
): PodiumCardData | null {
  const top3 = rankings
    .filter((r) => r.year === year && r.rank <= 3)
    .sort((a, b) => a.rank - b.rank);
  if (top3.length === 0) return null;

  const bookMap = new Map(books.map((b) => [b.book_id, b]));
  const entries: PodiumEntry[] = top3.map((r) => {
    const book = bookMap.get(r.book_id);
    return {
      rank: r.rank as 1 | 2 | 3,
      bookId: r.book_id,
      title: book?.title ?? "Untitled",
      coverUrl: book?.cover_url ?? null,
      score: book?.score ?? null,
    };
  });

  let closingLine: string | null = null;
  if (!sealedYears.has(year)) {
    closingLine = "The Weesels will have the final word in December.";
  } else {
    for (const category of BOTY_CATEGORY_PRIORITY) {
      const winner = weeselWinners.find((w) => w.year === year && w.category === category);
      if (!winner) continue;
      const book = bookMap.get(winner.book_id);
      if (book) closingLine = `The Weesels crowned "${book.title}" ${category}.`;
      break;
    }
  }

  return { type: "podium", entries, closingLine };
}

// ---------- (9) The prediction report ----------

export function computePredictionReport(books: WrappedBook[], year: number): PredictionReportCardData | null {
  const candidates = yearBooks(books, year).filter((b) => b.predicted_score != null && b.score != null);
  if (candidates.length === 0) return null;

  const withError = candidates.map((b) => ({
    bookId: b.book_id,
    title: b.title,
    predicted: b.predicted_score as number,
    actual: b.score as number,
    absError: Math.abs((b.predicted_score as number) - (b.score as number)),
  }));
  const seasonAccuracy = withError.reduce((sum, e) => sum + e.absError, 0) / withError.length;
  const bestCall = withError.reduce((a, b) => (b.absError < a.absError ? b : a));
  const biggestMiss = withError.reduce((a, b) => (b.absError > a.absError ? b : a));

  return { type: "prediction-report", seasonAccuracy, seasonCount: withError.length, bestCall, biggestMiss };
}

// ---------- (10) The rival verdict ----------

// Same day-of-year alignment idea as home's own Rival widget
// (app/home/rivalMath.ts), generalized from one fixed rival year to every
// tracked year -- a fair race, since a partial current year is compared
// against every other year at that SAME day-of-year cutoff, not their
// full-year totals.
export function computeRivalVerdict(
  dailyRows: DailyRow[],
  year: number,
  currentYear: number,
  today: string
): RivalVerdictCardData {
  const cutoffDay = year < currentYear ? 365 : daysBetweenInclusive(`${year}-01-01`, today);

  const bars: RivalYearBar[] = [];
  for (let y = APP_START_YEAR; y <= currentYear; y++) {
    const series = buildYearSeriesByDayOfYear(dailyRows, y);
    const idx = Math.min(cutoffDay - 1, series.length - 1);
    const pages = idx >= 0 ? (series[idx]?.y ?? 0) : 0;
    bars.push({ year: y, pages, isCurrent: y === year });
  }

  const sorted = [...bars].sort((a, b) => b.pages - a.pages);
  const rankIndex = sorted.findIndex((b) => b.year === year);

  return { type: "rival-verdict", bars, rank: rankIndex >= 0 ? rankIndex + 1 : null, total: bars.length };
}

// ---------- (11) Records set this year ----------

function snapshotContext(
  books: WrappedBook[],
  dailyRows: DailyRow[],
  formatDailyRows: FormatDailyRow[],
  cutoff: string
): RecordContext {
  return {
    books: books.filter((b) => b.date_finished != null && b.date_finished <= cutoff),
    dailyRows: dailyRows.filter((r) => r.date <= cutoff),
    formatDailyRows: formatDailyRows.filter((r) => r.date <= cutoff),
    tbrEntries: [], // TBR-based records (Doorstop Dodger, Hoarder Index) reflect
    // current queue state, not a point in time -- they never meaningfully
    // "get set" in a single year, so both passes below return NO for them
    // and they're naturally excluded from the diff rather than needing a
    // separate exclusion list.
    birthdayMMDD: null,
    year: null,
    start: `${APP_START_YEAR}-01-01`,
    end: cutoff,
  };
}

// Reruns every RECORD_GROUPS spec as of the day before this year started vs
// as of this year's end -- a spec whose holder or value changed between the
// two passes was, by construction, changed by something that happened
// during this year (the "before" pass excludes the year entirely). Same
// before/after-snapshot idea already used for the recap's Author Mover and
// home's Risers widget, just applied against the full all-time records
// engine instead of a narrower bespoke stat.
export function computeRecordsSet(
  books: WrappedBook[],
  dailyRows: DailyRow[],
  formatDailyRows: FormatDailyRow[],
  year: number
): RecordStampEntry[] {
  const beforeCtx = snapshotContext(books, dailyRows, formatDailyRows, `${year - 1}-12-31`);
  const afterCtx = snapshotContext(books, dailyRows, formatDailyRows, `${year}-12-31`);

  const entries: RecordStampEntry[] = [];
  for (const group of RECORD_GROUPS) {
    for (const spec of group.records) {
      const before = spec.compute(beforeCtx);
      const after = spec.compute(afterCtx);
      if (!after.ok) continue;
      const changed = !before.ok || before.holder !== after.holder || before.value !== after.value;
      if (!changed) continue;
      entries.push({ label: spec.label, detail: `${after.holder} — ${after.value}`, emoji: group.emoji });
    }
  }
  return entries;
}

// ---------- (12) The odometer turn ----------

// Lifetime totals as of THIS year's end, not "as of today" -- a past year's
// Wrapped has to freeze the odometer where it actually stood then, or a
// 2023 Wrapped regenerated today would misreport 2026's lifetime total.
export function computeOdometerTurn(books: WrappedBook[], dailyRows: DailyRow[], year: number): OdometerTurnCardData {
  const cutoff = `${year}-12-31`;
  const lifetimeBooks = books.filter((b) => b.date_finished != null && b.date_finished <= cutoff).length;
  const lifetimePages = dailyRows.filter((r) => r.date <= cutoff).reduce((sum, r) => sum + r.pages, 0);
  return {
    type: "odometer-turn",
    yearNumber: year - APP_START_YEAR + 1,
    yearPages: Math.round(pagesForYear(dailyRows, year)),
    lifetimeBooks,
    lifetimePages: Math.round(lifetimePages),
    lifetimeWords: Math.round(lifetimePages * AVG_WORDS_PER_PAGE),
  };
}

// ---------- (13) The epitaph ----------

// Prefers an actual answer to prompt #19 ("Describe the book in 5 words")
// from a book finished this year; falls back to a review excerpt if none
// exist, same "pool both, pick at random" spirit as generateStory's own
// getQuoteCandidate. Omitted (null) only if the year has neither.
export function computeEpitaph(
  books: WrappedBook[],
  year: number,
  fiveWordAnswers: FiveWordAnswer[]
): EpitaphCardData | null {
  const finished = yearBooks(books, year);
  const finishedIds = new Set(finished.map((b) => b.book_id));
  const bookMap = new Map(finished.map((b) => [b.book_id, b]));

  const pool = fiveWordAnswers.filter((a) => finishedIds.has(a.book_id) && a.answer.trim().length > 0);
  if (pool.length > 0) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const book = bookMap.get(pick.book_id);
    return {
      type: "epitaph",
      text: pick.answer.trim(),
      attribution: book?.title ?? "",
      coverUrl: book?.cover_url ?? null,
      bookId: pick.book_id,
    };
  }

  const reviewed = finished.filter((b) => b.review && b.review.trim().length > 0);
  if (reviewed.length > 0) {
    const pick = reviewed[Math.floor(Math.random() * reviewed.length)];
    const text = (pick.review as string).trim();
    return {
      type: "epitaph",
      text: text.length > 160 ? `${text.slice(0, 160).trimEnd()}…` : text,
      attribution: pick.title,
      coverUrl: pick.cover_url,
      bookId: pick.book_id,
    };
  }

  return null;
}

// ---------- Assembly ----------

export function buildWrappedCards(ctx: WrappedContext, year: number, today: string, currentYear: number): StoryCardData[] {
  const isFinal = year < currentYear;
  const rawDayOfYear = daysBetweenInclusive(`${year}-01-01`, today);
  const dayOfYear = isFinal ? rawDayOfYear : projectionDayOfYear(rawDayOfYear, today, ctx.dailyRows);
  const cards: StoryCardData[] = [];

  cards.push(computeColdOpen(ctx.books, ctx.dailyRows, year, isFinal, dayOfYear));
  cards.push(computeScale(ctx.books, ctx.dailyRows, year, isFinal, dayOfYear));
  cards.push(computeYearShape(ctx.dailyRows, year, today));

  const devouring = computeDevouring(ctx.books, year);
  if (devouring) cards.push(devouring);

  const authorOfYear = computeAuthorOfYear(ctx.books, year, ctx.authorPhotoMap);
  if (authorOfYear) cards.push(authorOfYear);

  const genreMap = computeGenreMap(ctx.books, year);
  if (genreMap) cards.push(genreMap);

  cards.push(computePerfectScores(ctx.books, year));

  const podium = computePodium(ctx.books, ctx.rankings, ctx.weeselWinners, ctx.sealedYears, year);
  if (podium) cards.push(podium);

  const predictions = computePredictionReport(ctx.books, year);
  if (predictions) cards.push(predictions);

  cards.push(computeRivalVerdict(ctx.dailyRows, year, currentYear, today));

  const recordsSet = computeRecordsSet(ctx.books, ctx.dailyRows, ctx.formatDailyRows, year);
  if (recordsSet.length > 0) cards.push({ type: "records-set", entries: recordsSet });

  cards.push(computeOdometerTurn(ctx.books, ctx.dailyRows, year));

  const epitaph = computeEpitaph(ctx.books, year, ctx.fiveWordAnswers);
  if (epitaph) cards.push(epitaph);

  return cards;
}
