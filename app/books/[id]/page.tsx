import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { fraunces } from "@/app/shared/fonts";
import { daysBetweenInclusive } from "@/app/shared/isoDate";
import { FORMAT_LABELS } from "@/app/shared/formatLabels";
import { RadarChart } from "@/app/shared/finish-ceremony/RadarChart";
import type { Book } from "@/app/shared/bookTypes";
import type { HonourItem } from "@/app/shared/HonourBadge";
import { computePredictedScore } from "@/lib/predictedScore";
import { computeDerivedStats } from "./derivedStats";
import { dash } from "./format";
import { BookHeader } from "./BookHeader";
import { RatingBars } from "./RatingBars";
import { PaceChart } from "./PaceChart";
import { DailyPagesChart } from "./DailyPagesChart";
import { rankColor } from "./rankColor";
import { EditModalProvider } from "./EditModalProvider";
import { EditTrigger } from "./EditTrigger";

export const dynamic = "force-dynamic";

async function getBook(bookId: number): Promise<Book | null> {
  const { rows } = await pool.query<Book>(
    `select book_id, title, author, author_id::int as author_id, series, genre, subgenre, year_read,
            year_released, format_raw, format_type, page_count, narrator,
            reread, isbn, status, cover_url, review, legacy_notes, indie,
            series_number::float8 as series_number,
            score::float8 as score,
            word_count::float8 as word_count,
            predicted_score::float8 as predicted_score,
            predicted_margin::float8 as predicted_margin,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books where book_id = $1`,
    [bookId]
  );
  return rows[0] ?? null;
}

type RankingInfo = { badge: string; background: string; color: string; rank: number; total: number; year: number };

async function getRankingInfo(bookId: number): Promise<RankingInfo | null> {
  const { rows } = await pool.query<{ rank: number; year: number; list_id: string }>(
    `select rank, year, list_id from book_rankings where book_id = $1 limit 1`,
    [bookId]
  );
  if (rows.length === 0) return null;
  const { rank, year, list_id } = rows[0];

  const { rows: countRows } = await pool.query<{ total: number }>(
    `select count(*)::int as total from book_rankings where list_id = $1`,
    [list_id]
  );
  const total = countRows[0].total;

  return { badge: `#${rank} · ${year}`, rank, total, year, ...rankColor(rank, total) };
}

async function getDailyReading(bookId: number): Promise<{ date: string; pages: number }[]> {
  const { rows } = await pool.query<{ date: string; pages: number }>(
    `select to_char(date, 'YYYY-MM-DD') as date, pages
     from daily_reading
     where book_id = $1
     order by date asc`,
    [bookId]
  );
  return rows;
}

async function getRatings(bookId: number): Promise<{ category: string; score: number }[]> {
  const { rows } = await pool.query<{ category: string; score: number }>(
    `select br.category, br.score::float8 as score
     from book_ratings br
     join rating_categories rc on rc.category = br.category
     where br.book_id = $1
     order by (rc.scope = 'universal') desc, br.category asc`,
    [bookId]
  );
  return rows;
}

async function getPromptAnswers(
  bookId: number
): Promise<{ id: number; question: string; answer: string }[]> {
  const { rows } = await pool.query<{ id: number; question: string; answer: string }>(
    `select pa.id, p.question, pa.answer
     from prompt_answers pa
     join prompts p on p.id = pa.prompt_id
     where pa.book_id = $1
     order by pa.answered_at asc`,
    [bookId]
  );
  return rows;
}

async function getBookHonours(bookId: number): Promise<HonourItem[]> {
  const { rows } = await pool.query<HonourItem>(
    `select w.year, wc.name as category, w.result
     from weesels w
     join weesel_categories wc on wc.id = w.category_id
     where w.book_id = $1
     order by w.year desc`,
    [bookId]
  );
  return rows;
}

async function getEditMetadata(): Promise<{ allGenres: string[]; seriesOptions: string[] }> {
  const [genres, series] = await Promise.all([
    pool.query<{ genre: string }>(`select genre from genres order by genre asc`),
    pool.query<{ series: string }>(
      `select distinct series from books where series is not null order by series asc`
    ),
  ]);
  return { allGenres: genres.rows.map((r) => r.genre), seriesOptions: series.rows.map((r) => r.series) };
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 text-sm last:border-0">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId)) notFound();

  const book = await getBook(bookId);
  if (!book) notFound();

  const [rankingInfo, ratings, promptAnswers, { allGenres, seriesOptions }, dailyReading, modelPrediction, honours] =
    await Promise.all([
      getRankingInfo(bookId),
      getRatings(bookId),
      getPromptAnswers(bookId),
      getEditMetadata(),
      getDailyReading(bookId),
      computePredictedScore(book),
      getBookHonours(bookId),
    ]);

  const { stats: derivedStats, paceChart } = await computeDerivedStats(
    book,
    rankingInfo && { rank: rankingInfo.rank, total: rankingInfo.total, year: rankingInfo.year }
  );

  const genreValue = book.genre ? (book.subgenre ? `${book.genre} (${book.subgenre})` : book.genre) : null;
  const formatValue = book.format_raw
    ? book.format_type === "audio" && book.narrator
      ? `${book.format_raw} · narrated by ${book.narrator}`
      : book.format_raw
    : book.format_type
      ? FORMAT_LABELS[book.format_type] ?? book.format_type
      : null;
  const wordsPages =
    [
      book.word_count != null ? `${Math.round(book.word_count).toLocaleString()} words` : null,
      book.page_count != null ? `${book.page_count} pages` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;
  const wordsPerPage =
    book.word_count != null && book.page_count != null && book.page_count > 0
      ? (book.word_count / book.page_count).toFixed(1)
      : null;

  let datesValue: string | null = null;
  if (book.date_started && book.date_finished) {
    const days = daysBetweenInclusive(book.date_started, book.date_finished);
    datesValue = `${book.date_started} → ${book.date_finished} · ${days} day${days === 1 ? "" : "s"}`;
  } else if (book.date_started) {
    datesValue = `${book.date_started} → —`;
  } else if (book.date_finished) {
    datesValue = `— → ${book.date_finished}`;
  }

  return (
    <EditModalProvider book={book} allGenres={allGenres} seriesOptions={seriesOptions}>
      <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-4xl space-y-10">
          <Link
            href="/library"
            className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            ← Library
          </Link>

          <BookHeader book={book} rankingInfo={rankingInfo} modelPrediction={modelPrediction} honours={honours} />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-hairline bg-card/40 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink`}>Details</h2>
              <div>
                <FieldRow label="Genre" value={dash(genreValue)} />
                <FieldRow label="Format" value={dash(formatValue)} />
                <FieldRow label="Words / Pages" value={dash(wordsPages)} />
                <FieldRow label="Words / Page" value={dash(wordsPerPage)} />
                <FieldRow label="Dates" value={dash(datesValue)} />
                {book.status && <FieldRow label="Status" value={book.status} />}
                <FieldRow label="Reread" value={book.reread ? "Yes" : "No"} />
              </div>
            </div>
            <div className="rounded-2xl border border-hairline bg-card/40 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink`}>Ratings</h2>
              {ratings.length > 0 && <RadarChart categories={ratings} />}
              <RatingBars ratings={ratings} />
            </div>
          </div>

          {(derivedStats.length > 0 || paceChart.length > 0 || dailyReading.length > 0) && (
            <div className="rounded-2xl border border-hairline bg-card/40 p-5">
              <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink`}>Stats</h2>
              {dailyReading.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Pages read per day
                  </p>
                  <DailyPagesChart days={dailyReading} />
                </div>
              )}
              {paceChart.length > 0 && (
                <div className="mb-4">
                  <PaceChart metrics={paceChart} />
                </div>
              )}
              {derivedStats.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {derivedStats.map((s) => (
                    <div key={s.label} className="rounded-lg border border-hairline bg-card/70 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{s.label}</p>
                      <p className="text-sm text-ink">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-card/40 p-5">
            <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink`}>Review</h2>
            {book.review ? (
              <p className="whitespace-pre-wrap text-ink">{book.review}</p>
            ) : (
              <p className="text-sm text-ink-faint">
                No review yet.{" "}
                <EditTrigger className="underline decoration-dotted underline-offset-4 hover:text-ink">
                  Add one
                </EditTrigger>
              </p>
            )}
          </div>

          {book.legacy_notes && (
            <div className="rounded-2xl border border-hairline bg-card/40 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink`}>From the archive</h2>
              <p className="whitespace-pre-wrap text-sm text-ink-faint">{book.legacy_notes}</p>
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-card/40 p-5">
            <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink`}>Card prompts</h2>
            {promptAnswers.length === 0 ? (
              <p className="text-sm text-ink-faint">No prompts answered for this book.</p>
            ) : (
              <div className="space-y-4">
                {promptAnswers.map((pa) => (
                  <div key={pa.id}>
                    <p className="text-sm text-ink-faint">{pa.question}</p>
                    <p className="mt-1 text-ink">{pa.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </EditModalProvider>
  );
}
