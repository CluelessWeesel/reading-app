import { daysBetweenInclusive } from "../shared/isoDate";
import { formatDateShort } from "../shared/formatDateShort";
import { ordinal } from "../books/[id]/format";
import { AVG_WORDS_PER_PAGE } from "../shared/avgPagesPerDay";
import type {
  AuthorMoverStat,
  AuthorOfMonthStat,
  BalanceStat,
  ClosingCardData,
  FinishedBookEntry,
  FinishedThisMonthCardData,
  MilestoneEntry,
  MonthShapeCardData,
  OdometerReading,
  PaceStat,
  PredictionsStat,
  RecapHeaderCardData,
  RecordEntry,
  StatTilesCardData,
  StoryCardData,
  TbrFlowStat,
  VsMonthsPastCardData,
  WeeselsWatchEntry,
} from "./types";

export const APP_START_YEAR = 2023;

export type RecapBook = {
  book_id: number;
  title: string;
  author: string | null;
  author_id: number | null;
  cover_url: string | null;
  score: number | null;
  page_count: number;
  word_count: number | null;
  format_type: string | null;
  predicted_score: number | null;
  date_finished: string | null;
};

export type DailyRow = { date: string; pages: number };
export type FormatDailyRow = { date: string; pages: number; format_type: string | null };
export type RankingRow = { book_id: number; rank: number; total: number };
export type WeeselsRow = { book_id: number; category: string };

export type RecapContext = {
  books: RecapBook[]; // all-time
  dailyRows: DailyRow[]; // all-time, sparse
  formatDailyRows: FormatDailyRow[]; // all-time, sparse (only recent months have real per-day rows)
  rankings: RankingRow[]; // all-time
  weesels: WeeselsRow[]; // all-time
  tbrAddedDates: string[]; // all-time
  fiveStarDates: string[]; // all-time, ascending
  authorIdMap: Map<string, number>;
};

function monthRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${period}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function daysInMonthOf(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function monthName(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
}

function pagesInRange(dailyRows: DailyRow[], start: string, end: string): number {
  return dailyRows.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + r.pages, 0);
}

function rankAuthorsByPages(books: RecapBook[]): { author: string; pages: number }[] {
  const byAuthor = new Map<string, number>();
  for (const b of books) {
    if (!b.author || !b.page_count) continue;
    byAuthor.set(b.author, (byAuthor.get(b.author) ?? 0) + b.page_count);
  }
  return Array.from(byAuthor.entries())
    .map(([author, pages]) => ({ author, pages }))
    .sort((a, b) => b.pages - a.pages);
}

// Every occurrence of the same calendar month (Jan 2023 through the target
// year) that actually has logged pages -- shared by the header's verdict
// and the "vs months past" card, which are the same underlying question
// asked two ways (a one-line rank vs. the full bar comparison).
function computeMonthAcrossYears(dailyRows: DailyRow[], monthNum: number, throughYear: number): { year: number; pages: number }[] {
  const years: number[] = [];
  for (let yr = APP_START_YEAR; yr <= throughYear; yr++) years.push(yr);
  return years
    .map((year) => {
      const start = `${year}-${String(monthNum).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
      const end = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { year, pages: pagesInRange(dailyRows, start, end) };
    })
    .filter((y) => y.pages > 0);
}

// Same "best-scored first" splay used by the original generic Hero card
// and Wrapped's cold open -- a visual reminder of what the period actually
// held before any numbers get named.
function topCovers(books: RecapBook[], start: string, end: string, limit = 5): string[] {
  return books
    .filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end && b.cover_url)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
    .map((b) => b.cover_url as string);
}

// ---------- 1. Header ----------

export function computeRecapHeader(
  books: RecapBook[],
  dailyRows: DailyRow[],
  period: string,
  generatedAt: string
): RecapHeaderCardData {
  const [y, m] = period.split("-").map(Number);
  const acrossYears = computeMonthAcrossYears(dailyRows, m, y);
  let verdict: string | null = null;
  if (acrossYears.length >= 2) {
    const sorted = [...acrossYears].sort((a, b) => b.pages - a.pages);
    const rank = sorted.findIndex((e) => e.year === y) + 1;
    if (rank > 0) verdict = `Your ${ordinal(rank)}-best ${monthName(period)} of ${acrossYears.length}`;
  }
  const { start, end } = monthRange(period);
  return {
    type: "recap-header",
    monthLabel: monthLabel(period),
    verdict,
    frozenDate: generatedAt.slice(0, 10),
    coverUrls: topCovers(books, start, end),
  };
}

// ---------- 2. Stat tiles ----------

// "vs your monthly average" compares against every OTHER month with any
// logged pages, as of whenever this is generated/regenerated -- not just
// months before this one. A frozen recap reflects the data available the
// moment it was frozen, same as everything else in this system.
export function computeStatTiles(dailyRows: DailyRow[], books: RecapBook[], period: string): StatTilesCardData {
  const { start, end } = monthRange(period);
  const pages = pagesInRange(dailyRows, start, end);
  const words = pages * AVG_WORDS_PER_PAGE;
  const finishedCount = books.filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end).length;

  const otherMonthKeys = new Set(dailyRows.map((r) => r.date.slice(0, 7)));
  otherMonthKeys.delete(period);
  const otherTotals = Array.from(otherMonthKeys).map((key) => {
    const [yy, mm] = key.split("-").map(Number);
    const s = `${key}-01`;
    const e = `${key}-${String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, "0")}`;
    return pagesInRange(dailyRows, s, e);
  });
  const avg = otherTotals.length > 0 ? otherTotals.reduce((s, v) => s + v, 0) / otherTotals.length : null;
  const pagesVsAveragePercent = avg != null && avg > 0 ? ((pages - avg) / avg) * 100 : null;

  return { type: "stat-tiles", pages, pagesVsAveragePercent, averagePages: avg, books: finishedCount, words };
}

// ---------- 3. Month shape ----------

export function computeMonthShape(dailyRows: DailyRow[], period: string): MonthShapeCardData | null {
  const { start, end } = monthRange(period);
  const monthRows = dailyRows.filter((r) => r.date >= start && r.date <= end);
  if (monthRows.length === 0) return null;

  const daysInMonth = daysInMonthOf(period);
  const byDate = new Map(monthRows.map((r) => [r.date, r.pages]));
  const bars: { date: string; pages: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${period}-${String(d).padStart(2, "0")}`;
    bars.push({ date, pages: byDate.get(date) ?? 0 });
  }

  const best = bars.reduce((a, b) => (b.pages > a.pages ? b : a), bars[0]);

  // The longest run of consecutive untouched days -- only named if it's
  // substantial (4+ days); a couple of quiet days here and there is just
  // normal life, not a "spell" worth calling out.
  let longestRun = 0;
  let longestRunStart: string | null = null;
  let longestRunEnd: string | null = null;
  let i = 0;
  while (i < bars.length) {
    if (bars[i].pages === 0) {
      const runStartDate = bars[i].date;
      let j = i;
      while (j < bars.length && bars[j].pages === 0) j++;
      if (j - i > longestRun) {
        longestRun = j - i;
        longestRunStart = runStartDate;
        longestRunEnd = bars[j - 1].date;
      }
      i = j;
    } else {
      i++;
    }
  }
  const quietCaption =
    longestRun >= 4 && longestRunStart && longestRunEnd
      ? `A quiet stretch from ${formatDateShort(longestRunStart)} to ${formatDateShort(longestRunEnd)} -- ${longestRun} days untouched.`
      : null;

  return { type: "month-shape", bars, bestDate: best.pages > 0 ? best.date : null, bestPages: best.pages, quietCaption };
}

// ---------- 4. Finished this month ----------

const PAGE_MILESTONE_STEP = 25_000;
const BOOK_MILESTONE_STEP = 50;

export function computeFinishedThisMonth(
  books: RecapBook[],
  rankings: RankingRow[],
  weesels: WeeselsRow[],
  period: string
): FinishedThisMonthCardData | null {
  const { start, end } = monthRange(period);
  const finished = books
    .filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end)
    .sort((a, b) => (a.date_finished as string).localeCompare(b.date_finished as string));
  if (finished.length === 0) return null;

  const rankByBookId = new Map(rankings.map((r) => [r.book_id, r]));
  const entries: FinishedBookEntry[] = finished.map((b) => {
    const r = rankByBookId.get(b.book_id);
    return {
      bookId: b.book_id,
      title: b.title,
      author: b.author,
      authorId: b.author_id,
      coverUrl: b.cover_url,
      score: b.score,
      rank: r?.rank ?? null,
      total: r?.total ?? null,
    };
  });

  // Milestones: lifetime pages/books odometer crossing a round number
  // partway through this month, walked in finish order with a running
  // total seeded from everything finished before this month started.
  const beforeMonth = books.filter((b) => b.date_finished && b.date_finished < start);
  let runningPages = beforeMonth.reduce((s, b) => s + (b.page_count ?? 0), 0);
  let runningBooks = beforeMonth.length;
  const milestones: MilestoneEntry[] = [];
  for (const b of finished) {
    const beforePages = runningPages;
    runningPages += b.page_count ?? 0;
    runningBooks += 1;
    if (Math.floor(runningPages / PAGE_MILESTONE_STEP) > Math.floor(beforePages / PAGE_MILESTONE_STEP)) {
      const milestoneValue = Math.floor(runningPages / PAGE_MILESTONE_STEP) * PAGE_MILESTONE_STEP;
      milestones.push({
        label: `Passed ${milestoneValue.toLocaleString()} lifetime pages`,
        date: formatDateShort(b.date_finished as string),
      });
    }
    if (runningBooks % BOOK_MILESTONE_STEP === 0) {
      milestones.push({ label: `Finished your ${runningBooks}th book`, date: formatDateShort(b.date_finished as string) });
    }
  }

  const weeselsByBook = new Map<number, string[]>();
  for (const w of weesels) {
    if (!weeselsByBook.has(w.book_id)) weeselsByBook.set(w.book_id, []);
    weeselsByBook.get(w.book_id)!.push(w.category);
  }
  const weeselsWatch: WeeselsWatchEntry[] = [];
  for (const b of finished) {
    for (const category of weeselsByBook.get(b.book_id) ?? []) {
      weeselsWatch.push({ title: b.title, bookId: b.book_id, category });
    }
  }

  return { type: "finished-this-month", books: entries, milestones, weeselsWatch };
}

// ---------- 5. Four-up stats ----------

export function computePace(dailyRows: DailyRow[], period: string): PaceStat | null {
  const { start, end } = monthRange(period);
  const daysInMonth = daysInMonthOf(period);
  const monthPages = pagesInRange(dailyRows, start, end);
  if (monthPages === 0) return null;

  const activeDates = new Set(dailyRows.filter((r) => r.pages > 0 && r.date >= start && r.date <= end).map((r) => r.date));
  let longestStreak = 0;
  let current = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${period}-${String(d).padStart(2, "0")}`;
    if (activeDates.has(date)) {
      current++;
      longestStreak = Math.max(longestStreak, current);
    } else {
      current = 0;
    }
  }

  return { avgPagesPerDay: monthPages / daysInMonth, longestStreak };
}

// Mirrors home's Balance widget in spirit (logs-preferred, finishes-
// degraded, "most/least ear-heavy since X") but scoped to one fixed
// calendar month rather than a rolling 3/6/12-month window -- different
// enough shape that duplicating the small amount of bucket logic locally
// was simpler and safer than reworking the shared widget module.
export function computeBalanceStat(formatDailyRows: FormatDailyRow[], books: RecapBook[], period: string): BalanceStat | null {
  const { start, end } = monthRange(period);
  const monthLogRows = formatDailyRows.filter((r) => r.date >= start && r.date <= end);

  let totalPages = 0;
  let audioPages = 0;
  if (monthLogRows.length > 0) {
    for (const r of monthLogRows) {
      totalPages += r.pages;
      if (r.format_type === "audio") audioPages += r.pages;
    }
  } else {
    const finished = books.filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end);
    for (const b of finished) {
      totalPages += b.page_count ?? 0;
      if (b.format_type === "audio") audioPages += b.page_count ?? 0;
    }
  }
  if (totalPages <= 0) return null;
  const audioSharePercent = (audioPages / totalPages) * 100;

  // Strictly BEFORE this period -- unlike stat-tiles' "vs average" (which
  // deliberately uses everything known as of generation time), a "most
  // ear-heavy since X" phrasing only makes sense if X is actually in the
  // past relative to the month being described.
  const monthKeysWithData = new Set(
    books
      .filter((b) => b.date_finished && b.date_finished.slice(0, 7) < period)
      .map((b) => (b.date_finished as string).slice(0, 7))
  );
  const history: { key: string; share: number }[] = [];
  for (const key of monthKeysWithData) {
    const [yy, mm] = key.split("-").map(Number);
    const s = `${key}-01`;
    const e = `${key}-${String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, "0")}`;
    const monthBooks = books.filter((b) => b.date_finished && b.date_finished >= s && b.date_finished <= e);
    const mTotal = monthBooks.reduce((s2, b) => s2 + (b.page_count ?? 0), 0);
    if (mTotal <= 0) continue;
    const mAudio = monthBooks.filter((b) => b.format_type === "audio").reduce((s2, b) => s2 + (b.page_count ?? 0), 0);
    history.push({ key, share: mAudio / mTotal });
  }

  let comparison = "First month with enough data to compare";
  if (history.length > 0) {
    const past = history.sort((a, b) => b.key.localeCompare(a.key));
    const avgPast = past.reduce((s, h) => s + h.share, 0) / past.length;
    const currentShare = audioSharePercent / 100;
    if (currentShare >= avgPast) {
      const since = past.find((h) => h.share >= currentShare);
      comparison = since ? `Most ear-heavy since ${monthLabel(since.key)}` : "Most ear-heavy month on record";
    } else {
      const since = past.find((h) => h.share <= currentShare);
      comparison = since ? `Least ear-heavy since ${monthLabel(since.key)}` : "Least ear-heavy month on record";
    }
  }

  return { audioSharePercent, comparison };
}

// Re-runs the pages leaderboard at month-start (books finished strictly
// before the 1st) vs month-end (through the last day) and finds the
// biggest percentile/rank-position climb -- same finished-books-only
// discipline as home's Risers widget (a currently-reading book must never
// count toward its author before it's actually done). Falls back to the
// biggest faller, clearly labelled, when nobody climbed at all.
export function computeAuthorMover(books: RecapBook[], period: string, authorIdMap: Map<string, number>): AuthorMoverStat | null {
  const { start, end } = monthRange(period);
  const beforeBooks = books.filter((b) => b.date_finished && b.date_finished < start);
  const afterBooks = books.filter((b) => b.date_finished && b.date_finished <= end);

  const before = rankAuthorsByPages(beforeBooks);
  const after = rankAuthorsByPages(afterBooks);
  if (before.length < 2 || after.length < 2) return null;

  function rankOf(name: string, list: { author: string }[]): number | null {
    const idx = list.findIndex((e) => e.author === name);
    return idx === -1 ? null : idx + 1;
  }

  const movers: { author: string; rankBefore: number; rankAfter: number; climb: number }[] = [];
  for (const entry of after) {
    const rankBefore = rankOf(entry.author, before);
    if (rankBefore == null) continue;
    const rankAfter = rankOf(entry.author, after) as number;
    if (rankAfter === rankBefore) continue;
    movers.push({ author: entry.author, rankBefore, rankAfter, climb: rankBefore - rankAfter });
  }
  if (movers.length === 0) return null;

  const winners = movers.filter((m) => m.climb > 0).sort((a, b) => b.climb - a.climb);
  const losers = movers.filter((m) => m.climb < 0).sort((a, b) => a.climb - b.climb);
  const pick = winners[0] ?? losers[0];
  if (!pick) return null;

  return {
    author: pick.author,
    authorId: authorIdMap.get(pick.author) ?? null,
    rankBefore: pick.rankBefore,
    rankAfter: pick.rankAfter,
    isFaller: pick.climb < 0,
  };
}

export function computePredictions(books: RecapBook[], period: string): PredictionsStat | null {
  const { start, end } = monthRange(period);
  const resolved = books.filter(
    (b) => b.predicted_score != null && b.score != null && b.date_finished && b.date_finished >= start && b.date_finished <= end
  );
  if (resolved.length === 0) return null;
  const avgAbsError = resolved.reduce((s, b) => s + Math.abs((b.predicted_score as number) - (b.score as number)), 0) / resolved.length;
  return { resolvedCount: resolved.length, avgAbsError };
}

// ---------- 6. Three-up row ----------

export function computeTbrFlow(tbrAddedDates: string[], finishedCount: number, period: string): TbrFlowStat | null {
  const { start, end } = monthRange(period);
  const added = tbrAddedDates.filter((d) => d >= start && d <= end).length;
  if (added === 0 && finishedCount === 0) return null;

  let verdict: string;
  if (added > finishedCount) verdict = `The pile grows -- added ${added - finishedCount} more than you cleared.`;
  else if (added < finishedCount) verdict = `Net progress -- cleared ${finishedCount - added} more than you added.`;
  else verdict = "Perfectly balanced -- one in, one out.";

  return { added, finished: finishedCount, verdict };
}

export function computeAuthorOfMonth(books: RecapBook[], period: string, authorIdMap: Map<string, number>): AuthorOfMonthStat | null {
  const { start, end } = monthRange(period);
  const finished = books.filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end);
  const ranked = rankAuthorsByPages(finished);
  if (ranked.length === 0) return null;
  const top = ranked[0];
  return { author: top.author, authorId: authorIdMap.get(top.author) ?? null, pages: top.pages };
}

// A deliberately narrower slice than the full /stats records registry
// (which needs a lot more context -- birthday, TBR entries, per-year
// scoping -- to run all ~25 of them): just the handful of "peaked, ended,
// or hit a round number" conditions that are cheap to check directly
// against this month's own data. Round-number lifetime milestones already
// surface inline in "finished this month", so they're deliberately left
// out here to avoid saying the same thing twice.
export function computeRecordsCorner(books: RecapBook[], dailyRows: DailyRow[], fiveStarDates: string[], period: string): RecordEntry[] | null {
  const { start, end } = monthRange(period);
  const entries: RecordEntry[] = [];

  const monthKeys = new Set(dailyRows.map((r) => r.date.slice(0, 7)));
  let bestMonth: { key: string; pages: number } | null = null;
  for (const key of monthKeys) {
    const [yy, mm] = key.split("-").map(Number);
    const s = `${key}-01`;
    const e = `${key}-${String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, "0")}`;
    const pages = pagesInRange(dailyRows, s, e);
    if (!bestMonth || pages > bestMonth.pages) bestMonth = { key, pages };
  }
  if (bestMonth && bestMonth.key === period) {
    entries.push({ label: "Golden Month", detail: `${bestMonth.pages.toLocaleString()} pages -- your best month ever` });
  }

  const monthFiveStars = fiveStarDates.filter((d) => d >= start && d <= end);
  if (monthFiveStars.length > 0) {
    const firstThisMonth = monthFiveStars[0];
    const priorDates = fiveStarDates.filter((d) => d < firstThisMonth);
    if (priorDates.length > 0) {
      const gapDays = daysBetweenInclusive(priorDates[priorDates.length - 1], firstThisMonth) - 1;
      if (gapDays >= 60) {
        entries.push({ label: "Five-star drought ended", detail: `${gapDays} days since your last one` });
      }
    }
  }

  return entries.length > 0 ? entries : null;
}

// ---------- 7. Vs months past ----------

export function computeVsMonthsPast(dailyRows: DailyRow[], period: string, odometer: OdometerReading): VsMonthsPastCardData | null {
  const [y, m] = period.split("-").map(Number);
  const acrossYears = computeMonthAcrossYears(dailyRows, m, y);
  if (acrossYears.length < 2) return null;

  const sorted = [...acrossYears].sort((a, b) => b.pages - a.pages);
  const current = acrossYears.find((e) => e.year === y);
  if (!current) return null;
  const rank = sorted.findIndex((e) => e.year === y) + 1;
  const recordPages = sorted[0].pages;

  return {
    type: "vs-months-past",
    monthName: monthName(period),
    bars: acrossYears.map((e) => ({ year: e.year, pages: e.pages, isCurrent: e.year === y })),
    rank,
    total: acrossYears.length,
    distanceToRecordPages: rank === 1 ? null : recordPages - current.pages,
    odometer,
  };
}

// ---------- 8. Closing ----------

export function computeClosing(
  period: string,
  pace: PaceStat | null,
  balance: BalanceStat | null,
  authorOfMonth: AuthorOfMonthStat | null,
  booksFinished: number
): ClosingCardData {
  const templates: string[] = [];

  if (booksFinished === 0) {
    templates.push("A month off the page.");
  } else {
    if (pace && pace.longestStreak >= 10) templates.push(`A ${pace.longestStreak}-day streak carried the month.`);
    if (balance && balance.audioSharePercent >= 70) templates.push("Mostly an audiobook month.");
    else if (balance && balance.audioSharePercent > 0 && balance.audioSharePercent <= 15) templates.push("Barely any audio this time.");
    if (authorOfMonth) templates.push(`${authorOfMonth.author} owned the month.`);
  }

  return {
    type: "closing",
    heading: `That's ${monthLabel(period)}.`,
    message: templates.length > 0 ? templates.join(" ") : "Just another month of reading.",
  };
}

// ---------- Assembly ----------

export function buildRecapCards(ctx: RecapContext, period: string, generatedAt: string): StoryCardData[] {
  const { start, end } = monthRange(period);
  const cards: StoryCardData[] = [];

  cards.push(computeRecapHeader(ctx.books, ctx.dailyRows, period, generatedAt));
  cards.push(computeStatTiles(ctx.dailyRows, ctx.books, period));

  const monthShape = computeMonthShape(ctx.dailyRows, period);
  if (monthShape) cards.push(monthShape);

  const finishedThisMonth = computeFinishedThisMonth(ctx.books, ctx.rankings, ctx.weesels, period);
  if (finishedThisMonth) cards.push(finishedThisMonth);

  const pace = computePace(ctx.dailyRows, period);
  const balance = computeBalanceStat(ctx.formatDailyRows, ctx.books, period);
  const authorMover = computeAuthorMover(ctx.books, period, ctx.authorIdMap);
  const predictions = computePredictions(ctx.books, period);
  const finishedCount = ctx.books.filter((b) => b.date_finished && b.date_finished >= start && b.date_finished <= end).length;
  const tbrFlow = computeTbrFlow(ctx.tbrAddedDates, finishedCount, period);
  const authorOfMonth = computeAuthorOfMonth(ctx.books, period, ctx.authorIdMap);
  if (pace || balance || authorMover || predictions || tbrFlow || authorOfMonth) {
    cards.push({ type: "month-glance", pace, balance, authorMover, predictions, tbrFlow, authorOfMonth });
  }

  const recordsCornerEntries = computeRecordsCorner(ctx.books, ctx.dailyRows, ctx.fiveStarDates, period);
  if (recordsCornerEntries && recordsCornerEntries.length > 0) {
    cards.push({ type: "records-corner", entries: recordsCornerEntries });
  }

  const lifetimeThroughMonth = ctx.books.filter((b) => b.date_finished && b.date_finished <= end);
  const odometer: OdometerReading = {
    books: lifetimeThroughMonth.length,
    pages: lifetimeThroughMonth.reduce((s, b) => s + (b.page_count ?? 0), 0),
    words: lifetimeThroughMonth.reduce((s, b) => s + (b.word_count ?? 0), 0),
  };
  const vsMonthsPast = computeVsMonthsPast(ctx.dailyRows, period, odometer);
  if (vsMonthsPast) cards.push(vsMonthsPast);

  cards.push(computeClosing(period, pace, balance, authorOfMonth, finishedCount));

  return cards;
}
