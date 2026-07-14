import type { ReactNode } from "react";
import { pool } from "@/lib/db";
import { fraunces } from "./shared/fonts";
import { rankColor } from "./books/[id]/rankColor";
import { daysBetweenInclusive } from "./shared/isoDate";
import { estimateFinishDate, percentComplete } from "./home/homeMath";
import { RightNowWidget } from "./home/RightNowWidget";
import { OnTrackWidget } from "./home/OnTrackWidget";
import { PaceRaceWidget } from "./home/PaceRaceWidget";
import { LatestFinishWidget } from "./home/LatestFinishWidget";
import { YearSoFarWidget } from "./home/YearSoFarWidget";
import { HonourNodWidget } from "./home/HonourNodWidget";
import { FromShelvesWidget } from "./home/FromShelvesWidget";
import { buildYearSeriesByDayOfYear, computeScopeData } from "./stats/statsMath";
import type { BookSummary, DailyRow, Goal } from "./stats/types";
import type {
  AuthorOfYear,
  BookOfTheYear,
  LatestFinish,
  RightNowBook,
  ShelfPick,
  TopBookOfYear,
} from "./home/types";

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

async function getBooks(): Promise<BookSummary[]> {
  const { rows } = await pool.query<Omit<BookSummary, "percentile" | "ratingsCount" | "promptAnswersCount">>(
    `select book_id, title, cover_url, year_read, author, author_id::int as author_id, series, genre, subgenre, narrator,
            year_released, page_count, format_type, format_raw, review,
            word_count::float8 as word_count, score::float8 as score,
            avg_pages_per_day::float8 as avg_pages_per_day,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books`
  );
  return rows.map((b) => ({ ...b, percentile: null, ratingsCount: 0, promptAnswersCount: 0 }));
}

async function getGoals(): Promise<Goal[]> {
  const { rows } = await pool.query<Goal>(`select year, pages_goal from reading_goals order by year asc`);
  return rows;
}

async function getRightNowBooks(today: string): Promise<RightNowBook[]> {
  const { rows } = await pool.query<{
    book_id: number;
    title: string;
    author: string | null;
    cover_url: string | null;
    format_type: string | null;
    page_count: number | null;
    position: number;
    date_started: string | null;
  }>(
    `select b.book_id, b.title, b.author, b.cover_url, b.format_type, b.page_count,
            cb.position::float8 as position,
            to_char(b.date_started, 'YYYY-MM-DD') as date_started
     from current_books cb
     join books b on b.book_id = cb.book_id
     order by cb.id asc`
  );
  return rows.map((b) => {
    const total = b.format_type === "audio" ? 100 : b.page_count;
    return {
      ...b,
      percent: percentComplete(b.position, total),
      estFinish: estimateFinishDate(b.position, total, b.date_started, today),
    };
  });
}

async function getTodayPages(today: string): Promise<number> {
  const { rows } = await pool.query<{ pages: number }>(
    `select coalesce(sum(pages), 0)::int as pages from daily_reading where date = $1`,
    [today]
  );
  return rows[0].pages;
}

async function getLatestFinish(): Promise<LatestFinish | null> {
  const { rows } = await pool.query<{
    book_id: number;
    title: string;
    author: string | null;
    cover_url: string | null;
    score: number | null;
    date_started: string | null;
    date_finished: string;
  }>(
    `select book_id, title, author, cover_url, score::float8 as score,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books
     where date_finished is not null
     order by date_finished desc, book_id desc
     limit 1`
  );
  const row = rows[0];
  if (!row) return null;

  const { rows: rankRows } = await pool.query<{ rank: number; list_id: string }>(
    `select rank, list_id from book_rankings where book_id = $1 limit 1`,
    [row.book_id]
  );
  let ranking = null;
  if (rankRows[0]) {
    const { rank, list_id } = rankRows[0];
    const { rows: cntRows } = await pool.query<{ total: number }>(
      `select count(*)::int as total from book_rankings where list_id = $1`,
      [list_id]
    );
    ranking = { rank, total: cntRows[0].total, ...rankColor(rank, cntRows[0].total) };
  }

  return {
    ...row,
    days: row.date_started != null ? daysBetweenInclusive(row.date_started, row.date_finished) : null,
    ranking,
  };
}

async function getAuthorOfYear(yearStart: string, today: string): Promise<AuthorOfYear> {
  const { rows } = await pool.query<{ id: number; name: string; totalPages: number }>(
    `select b.author_id::int as id, b.author as name, sum(b.page_count)::int as "totalPages"
     from books b
     where b.date_finished is not null and b.date_finished >= $1 and b.date_finished <= $2
       and b.author_id is not null
     group by b.author_id, b.author
     order by "totalPages" desc
     limit 1`,
    [yearStart, today]
  );
  return rows[0] ?? null;
}

async function getTopBookOfYear(currentYear: number): Promise<TopBookOfYear | null> {
  const { rows } = await pool.query<{ book_id: number; title: string; rank: number; total: number }>(
    `select br.book_id, b.title, br.rank, cnt.total
     from book_rankings br
     join books b on b.book_id = br.book_id
     join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
       on cnt.list_id = br.list_id
     where br.year = $1
     order by br.rank asc
     limit 1`,
    [currentYear]
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, ...rankColor(row.rank, row.total) };
}

// The weesels table has no literal "Book of the Year" category -- "Novel of
// the Year" is its closest/most general annual top-book honour, so that's
// what stands in for it here. Looked up via category_id/book_id (added by
// migration 0019) rather than matching the free-text nominee against
// books.title -- that matching used to silently miss winners with a typo'd
// title (found via "The Paper Meangerie" vs "The Paper Menagerie" earlier).
async function getBookOfTheYear(lastCompletedYear: number): Promise<BookOfTheYear> {
  const { rows } = await pool.query<{ year: number; title: string; author: string | null; book_id: number | null }>(
    `select w.year, coalesce(b.title, w.nominee) as title, coalesce(b.author, w.author_or_narrator) as author,
            w.book_id
     from weesels w
     join weesel_categories wc on wc.id = w.category_id
     left join books b on b.book_id = w.book_id
     where wc.name = 'Novel of the Year' and w.result = 'winner' and w.year = $1
     limit 1`,
    [lastCompletedYear]
  );
  return rows[0] ?? null;
}

async function getShelfPick(): Promise<ShelfPick> {
  const { rows } = await pool.query<{ book_id: number; title: string; author: string | null; cover_url: string | null }>(
    `select book_id, title, author, cover_url
     from books
     where cover_url is not null and review is not null and date_finished is not null
     order by random()
     limit 1`
  );
  return rows[0] ?? null;
}

export default async function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = Number(today.slice(0, 4));
  const yearStart = `${currentYear}-01-01`;

  const [
    dailyRows,
    books,
    goals,
    rightNowBooks,
    todayPages,
    latestFinish,
    authorOfYear,
    topBookOfYear,
    bookOfTheYear,
    shelfPick,
  ] = await Promise.all([
    getDailyRows(today),
    getBooks(),
    getGoals(),
    getRightNowBooks(today),
    getTodayPages(today),
    getLatestFinish(),
    getAuthorOfYear(yearStart, today),
    getTopBookOfYear(currentYear),
    getBookOfTheYear(currentYear - 1),
    getShelfPick(),
  ]);

  const currentYearData = computeScopeData({
    scope: { kind: "year", year: currentYear },
    today,
    currentYear,
    dailyRows,
    formatDailyRows: [],
    books,
    goals,
  });

  const priorYearSeries = YEARS.filter((y) => y < currentYear)
    .map((y) => ({ year: y, points: buildYearSeriesByDayOfYear(dailyRows, y) }))
    .filter((s) => s.points.some((p) => p.y > 0));

  // Full-width widgets (charts, and the 4-up stat row) span both columns;
  // the rest pair up side by side on wider screens. Reordering or adding a
  // widget later is just editing this list -- span is the only layout
  // decision made here, each widget's own content is unaffected.
  const widgets = [
    { key: "right-now", span: 1, node: (
        <RightNowWidget
          books={rightNowBooks}
          todayPages={todayPages}
          currentStreak={currentYearData.currentStreak}
        />
      ) },
    latestFinish && { key: "latest-finish", span: 1, node: <LatestFinishWidget finish={latestFinish} /> },
    { key: "on-track", span: 2, node: <OnTrackWidget data={currentYearData} currentYear={currentYear} /> },
    { key: "pace-race", span: 2, node: (
        <PaceRaceWidget
          currentYear={currentYear}
          currentYearSeries={currentYearData.series}
          priorYearSeries={priorYearSeries}
        />
      ) },
    { key: "year-so-far", span: 2, node: (
        <YearSoFarWidget
          currentYear={currentYear}
          booksFinished={currentYearData.booksFinished}
          totalPages={currentYearData.totalPages}
          totalWordsEstimate={currentYearData.totalWordsEstimate}
          authorOfYear={authorOfYear}
          topBook={topBookOfYear}
        />
      ) },
    { key: "honour-nod", span: 1, node: <HonourNodWidget honour={bookOfTheYear} /> },
    { key: "from-shelves", span: 1, node: <FromShelvesWidget pick={shelfPick} /> },
  ].filter(Boolean) as { key: string; span: 1 | 2; node: ReactNode }[];

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>
            Ethan&apos;s Reading
          </h1>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {widgets.map((w) => (
            <div key={w.key} className={w.span === 2 ? "md:col-span-2" : undefined}>
              {w.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
