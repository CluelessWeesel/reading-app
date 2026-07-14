import { addIsoDays, daysBetweenInclusive } from "../shared/isoDate";
import { formatDateShort } from "../shared/formatDateShort";
import { computeFlatLeaderboards } from "./leaderboardMath";
import type { BookSummary, DailyRow, FormatDailyRow, TbrEntry } from "./types";

export type RecordResult =
  | { ok: true; holder: string; holderHref?: string; value: string; when?: string }
  | { ok: false };

const NO: RecordResult = { ok: false };

function bookResult(book: BookSummary, value: string): RecordResult {
  return { ok: true, holder: book.title, holderHref: `/books/${book.book_id}`, value, when: book.date_finished ?? undefined };
}

function fmtWords(n: number): string {
  return `${Math.round(n).toLocaleString()} words`;
}
function fmtPages(n: number): string {
  return `${Math.round(n).toLocaleString()} pages`;
}
function rawDayDiff(a: string, b: string): number {
  return daysBetweenInclusive(a, b) - 1;
}
function monthKey(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// dailyRows only contains dates with an actual daily_reading row -- a day
// with zero reading is simply absent, not present with pages=0. Rolling
// windows and streaks need every calendar day accounted for, so this fills
// the gaps before either kind of computation touches the series.
function buildDenseSeries(dailyRows: DailyRow[], start: string, end: string): DailyRow[] {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  const series: DailyRow[] = [];
  let d = start;
  while (d <= end) {
    series.push({ date: d, pages: byDate.get(d) ?? 0 });
    d = addIsoDays(d, 1);
  }
  return series;
}

// The one shared context every record's compute function reads from --
// keeps the per-record functions to one signature each, so adding a new one
// is just another `{ key, label, compute }` entry (see RECORD_GROUPS at the
// bottom) rather than threading new parameters through every call site.
export type RecordContext = {
  books: BookSummary[]; // pre-filtered to the pass being computed (scoped or all-time)
  dailyRows: DailyRow[]; // same pre-filtering -- sparse, see buildDenseSeries above
  formatDailyRows: FormatDailyRow[];
  tbrEntries: TbrEntry[]; // never scope-filtered -- TBR isn't tied to a reading year
  birthdayMMDD: string | null;
  year: number | null; // the concrete year of this pass, or null for an all-time/unscoped pass
  start: string; // ISO date -- the pass's date range, for day-by-day walks
  end: string;
};

// ---------- ⚡ Speed ----------

function theDevouring(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => b.avg_pages_per_day != null && b.page_count >= 100);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.avg_pages_per_day as number) > (a.avg_pages_per_day as number) ? b : a));
  return bookResult(best, `${(best.avg_pages_per_day as number).toFixed(1)} pg/day`);
}

function theSlowBurn(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => {
    if (b.avg_pages_per_day == null || !b.date_started || !b.date_finished) return false;
    return daysBetweenInclusive(b.date_started, b.date_finished) >= 4;
  });
  if (candidates.length === 0) return NO;
  const worst = candidates.reduce((a, b) => ((b.avg_pages_per_day as number) < (a.avg_pages_per_day as number) ? b : a));
  return bookResult(worst, `${(worst.avg_pages_per_day as number).toFixed(1)} pg/day`);
}

function peakDay(ctx: RecordContext): RecordResult {
  if (ctx.dailyRows.length === 0) return NO;
  const best = ctx.dailyRows.reduce((a, b) => (b.pages > a.pages ? b : a));
  if (best.pages <= 0) return NO;
  return { ok: true, holder: formatDateShort(best.date), value: fmtPages(best.pages) };
}

function goldenWeek(ctx: RecordContext): RecordResult {
  const rows = buildDenseSeries(ctx.dailyRows, ctx.start, ctx.end);
  if (rows.length < 7) return NO;
  let bestSum = -1;
  let bestStart = 0;
  for (let i = 0; i <= rows.length - 7; i++) {
    let sum = 0;
    for (let j = i; j < i + 7; j++) sum += rows[j].pages;
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = i;
    }
  }
  if (bestSum <= 0) return NO;
  return {
    ok: true,
    holder: `${formatDateShort(rows[bestStart].date)} – ${formatDateShort(rows[bestStart + 6].date)}`,
    value: fmtPages(bestSum),
  };
}

function goldenMonth(ctx: RecordContext): RecordResult {
  const byMonth = new Map<string, number>();
  for (const r of ctx.dailyRows) byMonth.set(monthKey(r.date), (byMonth.get(monthKey(r.date)) ?? 0) + r.pages);
  if (byMonth.size === 0) return NO;
  const [key, total] = Array.from(byMonth.entries()).reduce((a, b) => (b[1] > a[1] ? b : a));
  if (total <= 0) return NO;
  return { ok: true, holder: monthLabel(key), value: fmtPages(total) };
}

function photoFinish(ctx: RecordContext): RecordResult {
  const finished = ctx.books.filter((b) => b.date_finished).sort((a, b) => (a.date_finished as string).localeCompare(b.date_finished as string));
  if (finished.length < 2) return NO;
  let bestGap = Infinity;
  let bestPair: [BookSummary, BookSummary] | null = null;
  for (let i = 1; i < finished.length; i++) {
    const gap = rawDayDiff(finished[i - 1].date_finished as string, finished[i].date_finished as string);
    if (gap < bestGap) {
      bestGap = gap;
      bestPair = [finished[i - 1], finished[i]];
    }
  }
  if (!bestPair) return NO;
  return {
    ok: true,
    holder: `${bestPair[0].title} → ${bestPair[1].title}`,
    value: bestGap === 0 ? "Same day" : `${bestGap} day${bestGap === 1 ? "" : "s"} apart`,
    when: bestPair[1].date_finished ?? undefined,
  };
}

// ---------- 📏 Size ----------

function theEverest(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => b.word_count != null);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.word_count as number) > (a.word_count as number) ? b : a));
  return bookResult(best, fmtWords(best.word_count as number));
}

function theEspresso(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => b.word_count != null);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.word_count as number) < (a.word_count as number) ? b : a));
  return bookResult(best, fmtWords(best.word_count as number));
}

// All-time only: "biggest year" doesn't have a meaningful per-year variant.
function monumentYear(ctx: RecordContext): RecordResult {
  const byYear = new Map<string, number>();
  for (const r of ctx.dailyRows) {
    const y = r.date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + r.pages);
  }
  if (byYear.size === 0) return NO;
  const [year, total] = Array.from(byYear.entries()).reduce((a, b) => (b[1] > a[1] ? b : a));
  if (total <= 0) return NO;
  return { ok: true, holder: year, value: fmtPages(total) };
}

function ironStreak(ctx: RecordContext): RecordResult {
  const series = buildDenseSeries(ctx.dailyRows, ctx.start, ctx.end);
  let bestLen = 0;
  let bestStart = "";
  let bestEnd = "";
  let curLen = 0;
  let curStart = "";
  for (const row of series) {
    if (row.pages > 0) {
      if (curLen === 0) curStart = row.date;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
        bestEnd = row.date;
      }
    } else {
      curLen = 0;
    }
  }
  if (bestLen === 0) return NO;
  return {
    ok: true,
    holder: `${bestLen} day${bestLen === 1 ? "" : "s"}`,
    value: `${formatDateShort(bestStart)} – ${formatDateShort(bestEnd)}`,
  };
}

// The anti-record: longest run of inactivity BETWEEN two logged reading
// days (not counting the unbounded ends of the whole history).
function theGreatSilence(ctx: RecordContext): RecordResult {
  const activeDates = ctx.dailyRows.filter((r) => r.pages > 0).map((r) => r.date).sort();
  if (activeDates.length < 2) return NO;
  let bestGap = -1;
  let bestStart = "";
  let bestEnd = "";
  for (let i = 1; i < activeDates.length; i++) {
    const gap = rawDayDiff(activeDates[i - 1], activeDates[i]) - 1; // days strictly between
    if (gap > bestGap) {
      bestGap = gap;
      bestStart = activeDates[i - 1];
      bestEnd = activeDates[i];
    }
  }
  if (bestGap <= 0) return NO;
  return {
    ok: true,
    holder: `${bestGap} day${bestGap === 1 ? "" : "s"} silent`,
    value: `${formatDateShort(bestStart)} – ${formatDateShort(bestEnd)}`,
  };
}

function centuryClub(ctx: RecordContext): RecordResult {
  if (ctx.year != null) {
    const count = ctx.dailyRows.filter((r) => r.pages >= 100).length;
    if (count === 0) return NO;
    return { ok: true, holder: `${count} day${count === 1 ? "" : "s"}`, value: "≥100 pages" };
  }
  const byYear = new Map<string, number>();
  for (const r of ctx.dailyRows) {
    if (r.pages < 100) continue;
    const y = r.date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  if (byYear.size === 0) return NO;
  const [year, count] = Array.from(byYear.entries()).reduce((a, b) => (b[1] > a[1] ? b : a));
  return { ok: true, holder: year, value: `${count} day${count === 1 ? "" : "s"} ≥100 pages` };
}

// ---------- 📅 Time ----------

function harvestMonth(ctx: RecordContext): RecordResult {
  const byMonth = new Map<string, number>();
  for (const b of ctx.books) {
    if (!b.date_finished) continue;
    const key = monthKey(b.date_finished);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  if (byMonth.size === 0) return NO;
  const [key, count] = Array.from(byMonth.entries()).reduce((a, b) => (b[1] > a[1] ? b : a));
  if (count === 0) return NO;
  return { ok: true, holder: monthLabel(key), value: `${count} book${count === 1 ? "" : "s"}` };
}

export function computeOpenerCloser(books: BookSummary[]): { opener: RecordResult; closer: RecordResult } {
  const finished = books.filter((b) => b.date_finished).sort((a, b) => (a.date_finished as string).localeCompare(b.date_finished as string));
  if (finished.length === 0) return { opener: NO, closer: NO };
  return { opener: bookResult(finished[0], "First finish"), closer: bookResult(finished[finished.length - 1], "Last finish") };
}

function newYearsDiscipline(ctx: RecordContext): RecordResult {
  let jan1 = 0;
  let dec31 = 0;
  for (const r of ctx.dailyRows) {
    if (r.date.endsWith("-01-01")) jan1 += r.pages;
    if (r.date.endsWith("-12-31")) dec31 += r.pages;
  }
  if (jan1 === 0 && dec31 === 0) return NO;
  const holder = jan1 === dec31 ? "Dead heat" : jan1 > dec31 ? "Resolution reader" : "Deadline reader";
  return { ok: true, holder, value: `Jan 1: ${jan1}pg · Dec 31: ${dec31}pg` };
}

export function computeBirthdayRead(books: BookSummary[], year: number, birthdayMMDD: string | null): RecordResult {
  if (!birthdayMMDD) return NO;
  const birthdayDate = `${year}-${birthdayMMDD}`;
  const match = books.find((b) => b.date_started && b.date_finished && b.date_started <= birthdayDate && birthdayDate <= b.date_finished);
  if (!match) return NO;
  return bookResult(match, formatDateShort(birthdayDate));
}

// ---------- 🎯 Taste ----------

function theCourtFavourite(ctx: RecordContext): RecordResult {
  const top = computeFlatLeaderboards(ctx.books, (b) => b.author, 2).avgScore[0];
  if (!top) return NO;
  return { ok: true, holder: top.name, value: top.primaryLabel };
}

function theLoyaltyAward(ctx: RecordContext): RecordResult {
  const top = computeFlatLeaderboards(ctx.books, (b) => b.author, 1).books[0];
  if (!top) return NO;
  return { ok: true, holder: top.name, value: top.primaryLabel };
}

function thePerfectGiant(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => b.score === 5 && b.word_count != null);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.word_count as number) > (a.word_count as number) ? b : a));
  return bookResult(best, fmtWords(best.word_count as number));
}

function theBeautifulFailure(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => b.score != null && b.score < 3 && b.word_count != null);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.word_count as number) > (a.word_count as number) ? b : a));
  return bookResult(best, `${fmtWords(best.word_count as number)} · ${(best.score as number).toFixed(1)}`);
}

function monthlyScoreExtreme(ctx: RecordContext, pick: "min" | "max"): RecordResult {
  const byMonth = new Map<string, number[]>();
  for (const b of ctx.books) {
    if (!b.date_finished || b.score == null) continue;
    const key = monthKey(b.date_finished);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(b.score);
  }
  const eligible = Array.from(byMonth.entries()).filter(([, scores]) => scores.length >= 2);
  if (eligible.length === 0) return NO;
  const withAvg = eligible.map(([key, scores]) => [key, scores.reduce((a, b) => a + b, 0) / scores.length] as const);
  const best = withAvg.reduce((a, b) => (pick === "min" ? (b[1] < a[1] ? b : a) : b[1] > a[1] ? b : a));
  return { ok: true, holder: monthLabel(best[0]), value: `${best[1].toFixed(2)} avg` };
}

function theColdStreak(ctx: RecordContext): RecordResult {
  return monthlyScoreExtreme(ctx, "min");
}
function theHoneymoon(ctx: RecordContext): RecordResult {
  return monthlyScoreExtreme(ctx, "max");
}

function theContrarianPick(ctx: RecordContext): RecordResult {
  const topAuthorEntry = computeFlatLeaderboards(ctx.books, (b) => b.author, 1).books[0];
  if (!topAuthorEntry) return NO;
  const theirBooks = ctx.books.filter((b) => b.author === topAuthorEntry.name && b.score != null);
  if (theirBooks.length === 0) return NO;
  const worst = theirBooks.reduce((a, b) => ((b.score as number) < (a.score as number) ? b : a));
  return bookResult(worst, `${(worst.score as number).toFixed(1)} · by ${topAuthorEntry.name}`);
}

function theRedemptionArc(ctx: RecordContext): RecordResult {
  const byAuthor = new Map<string, BookSummary[]>();
  for (const b of ctx.books) {
    if (b.score == null || !b.date_finished) continue;
    if (!byAuthor.has(b.author)) byAuthor.set(b.author, []);
    byAuthor.get(b.author)!.push(b);
  }
  let best: { author: string; delta: number; first: BookSummary; last: BookSummary } | null = null;
  for (const [author, books] of byAuthor) {
    if (books.length < 3) continue;
    const sorted = [...books].sort((a, b) => (a.date_finished as string).localeCompare(b.date_finished as string));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const delta = (last.score as number) - (first.score as number);
    if (delta > 0 && (!best || delta > best.delta)) best = { author, delta, first, last };
  }
  if (!best) return NO;
  return {
    ok: true,
    holder: best.author,
    value: `${(best.first.score as number).toFixed(1)} → ${(best.last.score as number).toFixed(1)}`,
  };
}

// ---------- 🃏 Oddities ----------

function theMarathon(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter((b) => b.date_started && b.date_finished);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) =>
    daysBetweenInclusive(b.date_started as string, b.date_finished as string) >
    daysBetweenInclusive(a.date_started as string, a.date_finished as string)
      ? b
      : a
  );
  const days = daysBetweenInclusive(best.date_started as string, best.date_finished as string);
  return bookResult(best, `${days} days`);
}

function thePossession(ctx: RecordContext): RecordResult {
  const byBook = new Map<number, { pages: number; dates: string[] }>();
  for (const r of ctx.formatDailyRows) {
    if (!byBook.has(r.book_id)) byBook.set(r.book_id, { pages: 0, dates: [] });
    const entry = byBook.get(r.book_id)!;
    entry.pages += r.pages;
    entry.dates.push(r.date);
  }
  const booksById = new Map(ctx.books.map((b) => [b.book_id, b]));
  let best: { book: BookSummary; wordsPerDay: number } | null = null;
  for (const [bookId, entry] of byBook) {
    const book = booksById.get(bookId);
    if (!book || book.word_count == null || book.page_count <= 0 || entry.dates.length === 0) continue;
    const span = daysBetweenInclusive(entry.dates.reduce((a, b) => (b < a ? b : a)), entry.dates.reduce((a, b) => (b > a ? b : a)));
    if (span <= 0) continue;
    const wordsLogged = (entry.pages / book.page_count) * book.word_count;
    const wordsPerDay = wordsLogged / span;
    if (!best || wordsPerDay > best.wordsPerDay) best = { book, wordsPerDay };
  }
  if (!best) return NO;
  return bookResult(best.book, `${Math.round(best.wordsPerDay).toLocaleString()} words/day`);
}

function genreTourist(ctx: RecordContext): RecordResult {
  const counts = new Map<string, number>();
  for (const b of ctx.books) {
    if (!b.genre) continue;
    counts.set(b.genre, (counts.get(b.genre) ?? 0) + 1);
  }
  if (counts.size === 0) return NO;
  const [genre, count] = Array.from(counts.entries()).reduce((a, b) => (b[1] < a[1] ? b : a));
  return { ok: true, holder: genre, value: `${count} book${count === 1 ? "" : "s"}` };
}

function theDoorstopDodger(ctx: RecordContext): RecordResult {
  const candidates = ctx.tbrEntries.filter((e) => e.word_count != null);
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.word_count as number) > (a.word_count as number) ? b : a));
  return { ok: true, holder: best.title, value: fmtWords(best.word_count as number) };
}

function theFormatTraitorMonth(ctx: RecordContext): RecordResult {
  const byMonth = new Map<string, { physical: number; audio: number }>();
  for (const r of ctx.formatDailyRows) {
    const key = monthKey(r.date);
    if (!byMonth.has(key)) byMonth.set(key, { physical: 0, audio: 0 });
    const entry = byMonth.get(key)!;
    if (r.format_type === "audio") entry.audio += r.pages;
    else entry.physical += r.pages;
  }
  if (byMonth.size < 2) return NO;
  let totalPhysical = 0;
  let totalAudio = 0;
  for (const { physical, audio } of byMonth.values()) {
    totalPhysical += physical;
    totalAudio += audio;
  }
  if (totalPhysical + totalAudio === 0) return NO;
  const norm = totalPhysical / (totalPhysical + totalAudio);

  let best: { key: string; deviation: number; fraction: number } | null = null;
  for (const [key, { physical, audio }] of byMonth) {
    const total = physical + audio;
    if (total === 0) continue;
    const fraction = physical / total;
    const deviation = Math.abs(fraction - norm);
    if (!best || deviation > best.deviation) best = { key, deviation, fraction };
  }
  if (!best) return NO;
  const leaning = best.fraction > norm ? "physical" : "audio";
  return { ok: true, holder: monthLabel(best.key), value: `${(best.deviation * 100).toFixed(0)}pt more ${leaning} than usual` };
}

const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "of", "in", "to", "for", "on", "at", "is", "with", "from", "by", "as", "or", "it",
]);

function dejaVu(ctx: RecordContext): RecordResult {
  const counts = new Map<string, number>();
  for (const b of ctx.books) {
    const words = b.title.toLowerCase().match(/[a-z']+/g) ?? [];
    const seen = new Set<string>();
    for (const w of words) {
      if (TITLE_STOPWORDS.has(w) || w.length < 3 || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const eligible = Array.from(counts.entries()).filter(([, n]) => n >= 2);
  if (eligible.length === 0) return NO;
  const [word, count] = eligible.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { ok: true, holder: word[0].toUpperCase() + word.slice(1), value: `${count} titles` };
}

function theHoarderIndex(ctx: RecordContext): RecordResult {
  const totalTbrWords = ctx.tbrEntries.reduce((sum, e) => sum + (e.word_count ?? 0), 0);
  if (totalTbrWords === 0) return NO;
  const withWords = ctx.books.filter((b) => b.word_count != null && b.date_finished);
  if (withWords.length === 0) return NO;
  const totalWords = withWords.reduce((sum, b) => sum + (b.word_count as number), 0);
  const dates = withWords.map((b) => b.date_finished as string).sort();
  const spanDays = daysBetweenInclusive(dates[0], dates[dates.length - 1]);
  if (spanDays <= 0) return NO;
  const wordsPerYear = (totalWords / spanDays) * 365;
  if (wordsPerYear <= 0) return NO;
  const years = totalTbrWords / wordsPerYear;
  return { ok: true, holder: `${years.toFixed(1)} years`, value: `${fmtWords(totalTbrWords)} queued` };
}

function theGhost(ctx: RecordContext): RecordResult {
  const candidates = ctx.books.filter(
    (b) => b.score != null && b.ratingsCount === 0 && b.promptAnswersCount === 0 && !b.review?.trim()
  );
  if (candidates.length === 0) return NO;
  const best = candidates.reduce((a, b) => ((b.score as number) > (a.score as number) ? b : a));
  return bookResult(best, `${(best.score as number).toFixed(1)} · undocumented`);
}

// ---------- Registry ----------

export type RecordSpec = {
  key: string;
  label: string;
  description: string;
  compute: (ctx: RecordContext) => RecordResult;
  allTimeOnly?: boolean;
};
export type RecordGroup = { emoji: string; title: string; records: RecordSpec[] };

export const RECORD_GROUPS: RecordGroup[] = [
  {
    emoji: "⚡",
    title: "Speed",
    records: [
      { key: "devouring", label: "The Devouring", description: "Fastest read, pages/day (minimum 100 pages).", compute: theDevouring },
      { key: "slow-burn", label: "The Slow Burn", description: "Slowest read, pages/day (minimum 4 days).", compute: theSlowBurn },
      { key: "peak-day", label: "Peak Day", description: "Most pages read in one calendar day.", compute: peakDay },
      { key: "golden-week", label: "The Golden Week", description: "Best 7-day rolling page total.", compute: goldenWeek },
      { key: "golden-month", label: "The Golden Month", description: "Best calendar month by total pages.", compute: goldenMonth },
      {
        key: "photo-finish",
        label: "The Photo Finish",
        description: "Fastest gap between two consecutive finish dates.",
        compute: photoFinish,
      },
    ],
  },
  {
    emoji: "📏",
    title: "Size",
    records: [
      { key: "everest", label: "The Everest", description: "Longest book finished, by word count.", compute: theEverest },
      { key: "espresso", label: "The Espresso", description: "Shortest book finished, by word count.", compute: theEspresso },
      {
        key: "monument-year",
        label: "The Monument Year",
        description: "Biggest reading year by total pages (always all-time).",
        compute: monumentYear,
        allTimeOnly: true,
      },
      {
        key: "iron-streak",
        label: "The Iron Streak",
        description: "Longest consecutive run of reading days.",
        compute: ironStreak,
      },
      {
        key: "great-silence",
        label: "The Great Silence",
        description: "The anti-record: longest gap between two reading days.",
        compute: theGreatSilence,
      },
      {
        key: "century-club",
        label: "The Century Club",
        description: "Count of days with 100+ pages read, and which year holds the record.",
        compute: centuryClub,
      },
    ],
  },
  {
    emoji: "📅",
    title: "Time",
    records: [
      { key: "harvest-month", label: "Harvest Month", description: "Most books finished in a single calendar month.", compute: harvestMonth },
      // "The Opener & The Closer" and "The Birthday Read" have bespoke
      // shapes (two winners, or a settings-dependent single year) and are
      // rendered directly by RecordsSection instead of through this list.
      {
        key: "new-years-discipline",
        label: "New Year's Discipline",
        description: "Pages read on Jan 1s vs Dec 31s -- resolution reader or deadline reader?",
        compute: newYearsDiscipline,
      },
    ],
  },
  {
    emoji: "🎯",
    title: "Taste",
    records: [
      {
        key: "court-favourite",
        label: "The Court Favourite",
        description: "Highest-rated author (minimum 2 books).",
        compute: theCourtFavourite,
      },
      { key: "loyalty-award", label: "The Loyalty Award", description: "Most-read author.", compute: theLoyaltyAward },
      { key: "perfect-giant", label: "The Perfect Giant", description: "Longest book scored a perfect 5.0.", compute: thePerfectGiant },
      {
        key: "beautiful-failure",
        label: "The Beautiful Failure",
        description: "Longest book scored under 3.0 -- most time invested in disappointment.",
        compute: theBeautifulFailure,
      },
      {
        key: "cold-streak",
        label: "The Cold Streak",
        description: "Harshest month by average score (minimum 2 finishes).",
        compute: theColdStreak,
      },
      {
        key: "honeymoon",
        label: "The Honeymoon",
        description: "Most generous month by average score (minimum 2 finishes).",
        compute: theHoneymoon,
      },
      {
        key: "contrarian-pick",
        label: "The Contrarian Pick",
        description: "Lowest-scored book from your most-read author.",
        compute: theContrarianPick,
      },
      {
        key: "redemption-arc",
        label: "The Redemption Arc",
        description: "Author whose score improved most from their first book to their latest (minimum 3 books).",
        compute: theRedemptionArc,
      },
    ],
  },
  {
    emoji: "🃏",
    title: "Oddities",
    records: [
      { key: "marathon", label: "The Marathon", description: "Most days spent on a single book.", compute: theMarathon },
      {
        key: "possession",
        label: "The Possession",
        description: "Highest words-per-day within one book's own logged reading window.",
        compute: thePossession,
      },
      {
        key: "genre-tourist",
        label: "Genre Tourist",
        description: "The rarest genre you still visited in scope.",
        compute: genreTourist,
      },
      {
        key: "doorstop-dodger",
        label: "The Doorstop Dodger",
        description: "Largest word count sitting in your TBR, never started (always all-time).",
        compute: theDoorstopDodger,
        allTimeOnly: true,
      },
      {
        key: "format-traitor-month",
        label: "The Format Traitor Month",
        description: "Month with the biggest physical/audio imbalance vs your overall norm.",
        compute: theFormatTraitorMonth,
      },
      {
        key: "deja-vu",
        label: "Déjà Vu",
        description: "The title word appearing most often across your library.",
        compute: dejaVu,
      },
      {
        key: "hoarder-index",
        label: "The Hoarder Index",
        description: "TBR word count divided by your annual reading rate -- years of queue owned (always all-time).",
        compute: theHoarderIndex,
        allTimeOnly: true,
      },
      {
        key: "ghost",
        label: "The Ghost",
        description: "Highest-rated book with no review, ratings, or prompt answers -- most loved, least documented.",
        compute: theGhost,
      },
    ],
  },
];
