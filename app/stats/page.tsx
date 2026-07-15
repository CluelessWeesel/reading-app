import { pool } from "@/lib/db";
import { todayLocalIso } from "@/app/shared/isoDate";
import { StatsView } from "./StatsView";
import type { BookSummary, DailyRow, FormatDailyRow, Goal, SeriesParent, TbrEntry } from "./types";

export const dynamic = "force-dynamic";

const START_DATE = "2023-01-01";
const YEARS = [2023, 2024, 2025, 2026];

async function getDailyRows(today: string): Promise<DailyRow[]> {
  const { rows } = await pool.query<DailyRow>(
    `select to_char(date, 'YYYY-MM-DD') as date, sum(pages)::int as pages
     from daily_reading
     where date between $1 and $2
     group by date
     order by date asc`,
    [START_DATE, today]
  );
  return rows;
}

// Only rows written through the /log flow carry a book_id (see migration
// 0008) -- that's what makes a physical-vs-audio split possible at all,
// since the format lives on the book, not the daily_reading row itself.
async function getFormatDailyRows(today: string): Promise<FormatDailyRow[]> {
  const { rows } = await pool.query<FormatDailyRow>(
    `select to_char(dr.date, 'YYYY-MM-DD') as date, dr.pages, b.format_type, dr.book_id
     from daily_reading dr
     join books b on b.book_id = dr.book_id
     where dr.book_id is not null and dr.date between $1 and $2
     order by dr.date asc`,
    [START_DATE, today]
  );
  return rows;
}

async function getBooks(): Promise<Omit<BookSummary, "percentile" | "ratingsCount" | "promptAnswersCount">[]> {
  const { rows } = await pool.query<Omit<BookSummary, "percentile" | "ratingsCount" | "promptAnswersCount">>(
    `select book_id, title, cover_url, year_read, author, author_id::int as author_id, series, genre, subgenre, narrator,
            year_released, page_count, format_type, format_raw, review,
            word_count::float8 as word_count, score::float8 as score,
            avg_pages_per_day::float8 as avg_pages_per_day,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books`
  );
  return rows;
}

// For "The Ghost" -- the highest-rated book with no review, no radar
// ratings, and no card-prompt answers (most loved, least documented).
async function getDocumentationCounts(): Promise<{ ratings: Map<number, number>; prompts: Map<number, number> }> {
  const [ratingsRes, promptsRes] = await Promise.all([
    pool.query<{ book_id: number; n: number }>(`select book_id, count(*)::int as n from book_ratings group by book_id`),
    pool.query<{ book_id: number; n: number }>(`select book_id, count(*)::int as n from prompt_answers group by book_id`),
  ]);
  return {
    ratings: new Map(ratingsRes.rows.map((r) => [r.book_id, r.n])),
    prompts: new Map(promptsRes.rows.map((r) => [r.book_id, r.n])),
  };
}

async function getTbrEntries(): Promise<TbrEntry[]> {
  const { rows } = await pool.query<TbrEntry>(`select title, author, word_count from tbr`);
  return rows;
}

async function getAppSettings(): Promise<Record<string, string>> {
  const { rows } = await pool.query<{ key: string; value: string }>(`select key, value from app_settings`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Percentile (1 = best, 0 = worst), scoped to the book's own year's ranked
// list -- comparable across years unlike a raw rank number, since it
// accounts for how many books that year actually had. Same formula as the
// dossier page's rank-color gradient (see app/books/[id]/rankColor.ts).
async function getPercentiles(): Promise<Map<number, number>> {
  const { rows } = await pool.query<{ book_id: number; rank: number; total: number }>(
    `select br.book_id, br.rank, cnt.total
     from book_rankings br
     join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
       on cnt.list_id = br.list_id
     where br.book_id is not null`
  );
  const map = new Map<number, number>();
  for (const r of rows) {
    const percentile = r.total > 1 ? 1 - (r.rank - 1) / (r.total - 1) : 1;
    map.set(r.book_id, percentile);
  }
  return map;
}

async function getGoals(): Promise<Goal[]> {
  const { rows } = await pool.query<Goal>(`select year, pages_goal from reading_goals order by year asc`);
  return rows;
}

async function getSeriesParents(): Promise<SeriesParent[]> {
  const { rows } = await pool.query<SeriesParent>(`select series, parent_series from series`);
  return rows;
}

async function getAllGenres(): Promise<string[]> {
  const { rows } = await pool.query<{ genre: string }>(`select genre from genres order by genre asc`);
  return rows.map((r) => r.genre);
}

export default async function StatsPage() {
  const today = todayLocalIso();
  const currentYear = Number(today.slice(0, 4));

  const [
    dailyRows,
    formatDailyRows,
    bookRows,
    goals,
    seriesParents,
    percentiles,
    allGenres,
    docCounts,
    tbrEntries,
    appSettings,
  ] = await Promise.all([
    getDailyRows(today),
    getFormatDailyRows(today),
    getBooks(),
    getGoals(),
    getSeriesParents(),
    getPercentiles(),
    getAllGenres(),
    getDocumentationCounts(),
    getTbrEntries(),
    getAppSettings(),
  ]);

  const books: BookSummary[] = bookRows.map((b) => ({
    ...b,
    percentile: percentiles.get(b.book_id) ?? null,
    ratingsCount: docCounts.ratings.get(b.book_id) ?? 0,
    promptAnswersCount: docCounts.prompts.get(b.book_id) ?? 0,
  }));

  return (
    <StatsView
      dailyRows={dailyRows}
      formatDailyRows={formatDailyRows}
      books={books}
      goals={goals}
      seriesParents={seriesParents}
      allGenres={allGenres}
      tbrEntries={tbrEntries}
      appSettings={appSettings}
      today={today}
      currentYear={currentYear}
      years={YEARS}
    />
  );
}
