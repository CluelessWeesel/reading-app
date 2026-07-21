import { pool } from "@/lib/db";
import { todayLocalIso } from "../shared/isoDate";
import { buildRecapCards } from "./recapMath";
import type { RecapBook, RecapContext } from "./recapMath";
import { buildWrappedCards } from "./wrappedMath";
import type { FiveWordAnswer, WeeselWinnerRow, WrappedBook, WrappedContext, WrappedRankingRow } from "./wrappedMath";
import type { StoryPayload, StoryType } from "./types";

// All-time context for the rich recap deck (app/stories/recapMath.ts) --
// every section needs to compare this month against the full history, so
// unlike the generic wrapped path above, this always pulls everything
// rather than a single date range.
async function getRecapContext(): Promise<RecapContext> {
  const [booksRes, dailyRes, formatDailyRes, rankingsRes, weeselsRes, tbrRes, fiveStarRes] = await Promise.all([
    pool.query<RecapBook>(
      `select book_id, title, author, author_id::int as author_id, cover_url,
              score::float8 as score, page_count, word_count::float8 as word_count,
              format_type, predicted_score::float8 as predicted_score,
              to_char(date_finished, 'YYYY-MM-DD') as date_finished
       from books`
    ),
    pool.query<{ date: string; pages: number }>(
      `select to_char(date, 'YYYY-MM-DD') as date, sum(pages)::int as pages
       from daily_reading
       group by date
       order by date asc`
    ),
    pool.query<{ date: string; pages: number; format_type: string | null }>(
      `select to_char(dr.date, 'YYYY-MM-DD') as date, dr.pages, b.format_type
       from daily_reading dr
       join books b on b.book_id = dr.book_id
       where dr.book_id is not null`
    ),
    pool.query<{ book_id: number; rank: number; total: number }>(
      `select br.book_id, br.rank, cnt.total
       from book_rankings br
       join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
         on cnt.list_id = br.list_id`
    ),
    pool.query<{ book_id: number; category: string }>(
      `select w.book_id, wc.name as category
       from weesels w
       join weesel_categories wc on wc.id = w.category_id
       where w.book_id is not null`
    ),
    pool.query<{ added_at: string }>(
      `select to_char(coalesce(owned_added_at, unowned_added_at, created_at), 'YYYY-MM-DD') as added_at from tbr`
    ),
    // Floored at 2023-01-01 -- an old five-star from before this app
    // tracked anything would inflate the drought record with a gap that
    // has nothing to do with actual reading rhythm (same floor as home's
    // own five-star drought widget).
    pool.query<{ date_finished: string }>(
      `select to_char(date_finished, 'YYYY-MM-DD') as date_finished
       from books
       where score = 5 and date_finished is not null and date_finished >= '2023-01-01'
       order by date_finished asc`
    ),
  ]);

  const authorIdMap = new Map<string, number>();
  for (const b of booksRes.rows) {
    if (b.author && b.author_id != null && !authorIdMap.has(b.author)) authorIdMap.set(b.author, b.author_id);
  }

  return {
    books: booksRes.rows,
    dailyRows: dailyRes.rows,
    formatDailyRows: formatDailyRes.rows,
    rankings: rankingsRes.rows,
    weesels: weeselsRes.rows,
    tbrAddedDates: tbrRes.rows.map((r) => r.added_at),
    fiveStarDates: fiveStarRes.rows.map((r) => r.date_finished),
    authorIdMap,
  };
}

async function computeRecapPayload(period: string): Promise<StoryPayload> {
  const ctx = await getRecapContext();
  const cards = buildRecapCards(ctx, period, todayLocalIso());
  return { cards };
}

// All-time context for the Wrapped deck (app/stories/wrappedMath.ts) -- the
// books query mirrors app/stats/page.tsx's getBooks() (full BookSummary
// shape, so RECORD_GROUPS/leaderboardMath work against it unmodified) plus
// predicted_score, which BookSummary doesn't carry but the prediction
// report card needs.
async function getWrappedContext(): Promise<WrappedContext> {
  const [booksRes, docCountsRes, dailyRes, formatDailyRes, rankingsRes, weeselWinnersRes, sealedYearsRes, photosRes, fiveWordRes] =
    await Promise.all([
      pool.query<WrappedBook>(
        `select book_id, title, cover_url, year_read, author, author_id::int as author_id, series, genre, subgenre,
                narrator, year_released, page_count, format_type, format_raw, review, indie,
                word_count::float8 as word_count, score::float8 as score,
                avg_pages_per_day::float8 as avg_pages_per_day,
                predicted_score::float8 as predicted_score,
                to_char(date_started, 'YYYY-MM-DD') as date_started,
                to_char(date_finished, 'YYYY-MM-DD') as date_finished
         from books`
      ),
      Promise.all([
        pool.query<{ book_id: number; n: number }>(`select book_id, count(*)::int as n from book_ratings group by book_id`),
        pool.query<{ book_id: number; n: number }>(`select book_id, count(*)::int as n from prompt_answers group by book_id`),
      ]),
      pool.query<{ date: string; pages: number }>(
        `select to_char(date, 'YYYY-MM-DD') as date, sum(pages)::int as pages from daily_reading group by date order by date asc`
      ),
      pool.query<{ date: string; pages: number; format_type: string | null; book_id: number }>(
        `select to_char(dr.date, 'YYYY-MM-DD') as date, dr.pages, b.format_type, dr.book_id
         from daily_reading dr
         join books b on b.book_id = dr.book_id
         where dr.book_id is not null`
      ),
      pool.query<{ book_id: number; year: number; rank: number; total: number }>(
        `select br.book_id, br.year, br.rank, cnt.total
         from book_rankings br
         join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
           on cnt.list_id = br.list_id
         where br.book_id is not null`
      ),
      // weesels.book_id is bigint (unlike books.book_id, a plain integer) --
      // pg returns bigint columns as strings by default, which would silently
      // fail every bookMap.get(winner.book_id) lookup in computePodium
      // without this cast.
      pool.query<WeeselWinnerRow>(
        `select w.book_id::int as book_id, w.year, wc.name as category
         from weesels w
         join weesel_categories wc on wc.id = w.category_id
         where w.result = 'winner' and w.book_id is not null`
      ),
      pool.query<{ year: number }>(`select year from weesel_years`),
      pool.query<{ id: number; photo_url: string | null }>(`select id::int as id, photo_url from authors`),
      pool.query<FiveWordAnswer>(
        `select book_id, answer from prompt_answers where prompt_id = 19 and answer is not null and length(trim(answer)) > 0`
      ),
    ]);

  const [ratingsRes, promptsRes] = docCountsRes;
  const ratingsCount = new Map(ratingsRes.rows.map((r) => [r.book_id, r.n]));
  const promptAnswersCount = new Map(promptsRes.rows.map((r) => [r.book_id, r.n]));

  const percentileMap = new Map<number, number>();
  for (const r of rankingsRes.rows) {
    percentileMap.set(r.book_id, r.total > 1 ? 1 - (r.rank - 1) / (r.total - 1) : 1);
  }

  const books: WrappedBook[] = booksRes.rows.map((b) => ({
    ...b,
    percentile: percentileMap.get(b.book_id) ?? null,
    ratingsCount: ratingsCount.get(b.book_id) ?? 0,
    promptAnswersCount: promptAnswersCount.get(b.book_id) ?? 0,
  }));

  const rankings: WrappedRankingRow[] = rankingsRes.rows.map((r) => ({ book_id: r.book_id, year: r.year, rank: r.rank }));

  return {
    books,
    dailyRows: dailyRes.rows,
    // format_type is null only for data-quality edge cases (the join is on
    // a book row that exists but never got a format set) -- FormatDailyRow
    // requires it non-null, and a handful of excluded rows here doesn't
    // change any format-split math meaningfully.
    formatDailyRows: formatDailyRes.rows
      .filter((r): r is typeof r & { format_type: string } => r.format_type != null),
    rankings,
    weeselWinners: weeselWinnersRes.rows,
    sealedYears: new Set(sealedYearsRes.rows.map((r) => r.year)),
    authorPhotoMap: new Map(photosRes.rows.map((r) => [r.id, r.photo_url])),
    fiveWordAnswers: fiveWordRes.rows,
  };
}

async function computeWrappedPayload(period: string): Promise<StoryPayload> {
  const year = Number(period);
  const today = todayLocalIso();
  const currentYear = Number(today.slice(0, 4));
  const ctx = await getWrappedContext();
  const cards = buildWrappedCards(ctx, year, today, currentYear);
  return { cards, final: year < currentYear };
}

export async function computeStoryPayload(storyType: StoryType, period: string): Promise<StoryPayload> {
  return storyType === "recap" ? computeRecapPayload(period) : computeWrappedPayload(period);
}
