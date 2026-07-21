import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
import { ReviewTrigger } from "./ReviewTrigger";
import { DropCapText } from "@/app/shared/DropCap";

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

type AdjustmentHistoryEvent = {
  kind: "rank" | "score";
  old_val: number | null;
  new_val: number | null;
  reason: string;
  changed_at: string;
};

// Only ever the sanctioned end-of-year adjustment events (reason is not
// null) -- a plain, unremarkable rank/score edit outside the window
// doesn't show up here at all. See app/rankings/adjustmentWindow.ts.
async function getAdjustmentHistory(bookId: number): Promise<AdjustmentHistoryEvent[]> {
  const { rows } = await pool.query<AdjustmentHistoryEvent>(
    `select 'rank' as kind, rc.old_rank::numeric as old_val, rc.new_rank::numeric as new_val,
            rc.reason, to_char(rc.changed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as changed_at
     from rank_changes rc
     where rc.book_id = $1 and rc.reason is not null
     union all
     select 'score' as kind, sc.old_score as old_val, sc.new_score as new_val,
            sc.reason, to_char(sc.changed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as changed_at
     from score_changes sc
     where sc.book_id = $1 and sc.reason is not null
     order by changed_at desc`,
    [bookId]
  );
  return rows;
}

type TierHistoryEvent = { from_tier: string | null; to_tier: string; moved_at: string; note: string | null };

// currentTier is null for a book that hasn't entered the tier board yet
// (still being read, or -- during the opening fill -- simply not reached
// yet). history is empty for every book placed during that fill, by
// design (see /api/tier-board/place): only moves after the fill was
// completed ever get logged.
async function getTierInfo(bookId: number): Promise<{ currentTier: string | null; history: TierHistoryEvent[] }> {
  const [tierRes, movesRes] = await Promise.all([
    pool.query<{ tier: string }>(`select tier from book_tiers where book_id = $1`, [bookId]),
    pool.query<TierHistoryEvent>(
      `select from_tier, to_tier, to_char(moved_at, 'YYYY-MM-DD') as moved_at, note
       from tier_moves where book_id = $1 order by moved_at desc`,
      [bookId]
    ),
  ]);
  return { currentTier: tierRes.rows[0]?.tier ?? null, history: movesRes.rows };
}

async function getBookNarrators(bookId: number): Promise<{ id: number; name: string }[]> {
  const { rows } = await pool.query<{ id: number; name: string }>(
    `select n.id::int as id, n.name
     from book_narrators bn
     join narrators n on n.id = bn.narrator_id
     where bn.book_id = $1
     order by n.name asc`,
    [bookId]
  );
  return rows;
}

async function getEditMetadata(): Promise<{ allGenres: string[]; seriesOptions: string[]; subgenreOptions: string[] }> {
  const [genres, series, subgenres] = await Promise.all([
    pool.query<{ genre: string }>(`select genre from genres order by genre asc`),
    pool.query<{ series: string }>(
      `select distinct series from books where series is not null order by series asc`
    ),
    pool.query<{ subgenre: string }>(
      `select distinct subgenre from (
         select subgenre from books where subgenre is not null
         union
         select subgenre from tbr where subgenre is not null
       ) s order by subgenre asc`
    ),
  ]);
  return {
    allGenres: genres.rows.map((r) => r.genre),
    seriesOptions: series.rows.map((r) => r.series),
    subgenreOptions: subgenres.rows.map((r) => r.subgenre),
  };
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gold py-2 text-sm last:border-0">
      <span className="text-ink-warm-faint">{label}</span>
      <span className="text-right text-ink-warm">{value}</span>
    </div>
  );
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId)) notFound();

  const book = await getBook(bookId);
  if (!book) notFound();

  const [rankingInfo, ratings, promptAnswers, { allGenres, seriesOptions, subgenreOptions }, dailyReading, modelPrediction, honours, adjustmentHistory, bookNarrators, tierInfo] =
    await Promise.all([
      getRankingInfo(bookId),
      getRatings(bookId),
      getPromptAnswers(bookId),
      getEditMetadata(),
      getDailyReading(bookId),
      computePredictedScore(book),
      getBookHonours(bookId),
      getAdjustmentHistory(bookId),
      getBookNarrators(bookId),
      getTierInfo(bookId),
    ]);

  const { stats: derivedStats, paceChart } = await computeDerivedStats(
    book,
    rankingInfo && { rank: rankingInfo.rank, total: rankingInfo.total, year: rankingInfo.year }
  );

  const genreValue = book.genre ? (book.subgenre ? `${book.genre} (${book.subgenre})` : book.genre) : null;
  // Narrator names link to /narrators/id when resolved (via book_narrators
  // -- a duet/cast joins with ", "); falls back to the raw books.narrator
  // text for anything unresolved (e.g. "Full Cast", which deliberately has
  // no narrator row).
  const narratorNode: ReactNode =
    bookNarrators.length > 0 ? (
      <>
        {bookNarrators.map((n, i) => (
          <span key={n.id}>
            {i > 0 && ", "}
            <Link href={`/narrators/${n.id}`} className="underline decoration-dotted underline-offset-2 hover:text-ink-warm">
              {n.name}
            </Link>
          </span>
        ))}
      </>
    ) : (
      book.narrator
    );
  const formatValue: ReactNode = book.format_raw
    ? book.format_type === "audio" && book.narrator
      ? <>{book.format_raw} · narrated by {narratorNode}</>
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
    <EditModalProvider book={book} allGenres={allGenres} seriesOptions={seriesOptions} subgenreOptions={subgenreOptions}>
      <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-4xl space-y-10">
          <Link
            href="/library"
            className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
          >
            ← Library
          </Link>

          <BookHeader book={book} rankingInfo={rankingInfo} modelPrediction={modelPrediction} honours={honours} />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink-warm`}>Details</h2>
              <div>
                <FieldRow label="Genre" value={dash(genreValue)} />
                <FieldRow label="Format" value={formatValue ?? "—"} />
                <FieldRow label="Words / Pages" value={dash(wordsPages)} />
                <FieldRow label="Words / Page" value={dash(wordsPerPage)} />
                <FieldRow label="Dates" value={dash(datesValue)} />
                {book.status && <FieldRow label="Status" value={book.status} />}
                <FieldRow label="Reread" value={book.reread ? "Yes" : "No"} />
              </div>
            </div>
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink-warm`}>Ratings</h2>
              {ratings.length > 0 && <RadarChart categories={ratings} />}
              <RatingBars ratings={ratings} />
            </div>
          </div>

          {(derivedStats.length > 0 || paceChart.length > 0 || dailyReading.length > 0) && (
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>Stats</h2>
              {dailyReading.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">
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
                    <div key={s.label} className="rounded-lg border border-gold bg-surface-1 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">{s.label}</p>
                      <p className="text-sm text-ink-warm">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {book.status !== "reading" && (
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>Review</h2>
                {book.review && (
                  <ReviewTrigger className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm">
                    Edit
                  </ReviewTrigger>
                )}
              </div>
              {book.review ? (
                <DropCapText
                  text={book.review}
                  className={`${fraunces.className} whitespace-pre-wrap text-lg italic leading-relaxed text-ink-warm`}
                />
              ) : (
                <p className="text-sm text-ink-warm-faint">
                  No review yet.{" "}
                  <ReviewTrigger className="underline decoration-dotted underline-offset-4 hover:text-ink-warm">
                    Add one
                  </ReviewTrigger>
                </p>
              )}
            </div>
          )}

          {book.legacy_notes && (
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink-warm`}>From the archive</h2>
              <p className="whitespace-pre-wrap text-sm text-ink-warm-faint">{book.legacy_notes}</p>
            </div>
          )}

          {adjustmentHistory.length > 0 && (
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>Adjustment history</h2>
              <ul className="divide-y divide-gold">
                {adjustmentHistory.map((e, i) => {
                  const [datePart, timePart] = e.changed_at.split("T");
                  const fmt = (v: number | null) =>
                    v == null ? "unranked" : e.kind === "rank" ? `#${v}` : v.toFixed(1);
                  return (
                    <li key={`${e.kind}-${e.changed_at}-${i}`} className="py-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="font-medium text-ink-warm">
                          {e.kind === "rank" ? "Rank" : "Score"}: {fmt(e.old_val)} → {fmt(e.new_val)}
                        </span>
                        <span className="text-xs text-ink-warm-faint">
                          {datePart} {timePart?.slice(0, 5) ?? ""}
                        </span>
                      </div>
                      <p className="text-xs italic text-ink-warm-faint">{e.reason}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(tierInfo.currentTier || tierInfo.history.length > 0) && (
            <div className="rounded-2xl border border-gold bg-surface-1 p-5">
              <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>Tier history</h2>
              {tierInfo.currentTier && (
                <p className="mb-3 text-sm text-ink-warm">
                  Currently in{" "}
                  <span className="font-semibold">
                    {tierInfo.currentTier === "holding" ? "Holding" : tierInfo.currentTier}
                  </span>
                </p>
              )}
              {tierInfo.history.length > 0 && (
                <ul className="divide-y divide-gold">
                  {tierInfo.history.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                      <span className="text-ink-warm">
                        {e.from_tier == null ? "Entered" : e.from_tier === "holding" ? "Holding" : e.from_tier} →{" "}
                        <span className="font-medium">{e.to_tier === "holding" ? "Holding" : e.to_tier}</span>
                      </span>
                      <span className="text-xs text-ink-warm-faint">{e.moved_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gold bg-surface-1 p-5">
            <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>Card prompts</h2>
            {promptAnswers.length === 0 ? (
              <p className="text-sm text-ink-warm-faint">No prompts answered for this book.</p>
            ) : (
              <div className="space-y-4">
                {promptAnswers.map((pa) => (
                  <div key={pa.id}>
                    <p className="text-sm text-ink-warm-faint">{pa.question}</p>
                    <p className="mt-1 text-ink-warm">{pa.answer}</p>
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
