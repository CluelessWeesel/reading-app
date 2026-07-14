import { notFound } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { fraunces } from "@/app/shared/fonts";
import { getCategories, getWeeselRows } from "@/app/weesels/data";
import { categoryNameOf, creditedAuthorId } from "@/app/weesels/weeselMath";
import { AuthorHeader } from "./AuthorHeader";
import { Bookshelf } from "./Bookshelf";
import { QueuedStrip } from "./QueuedStrip";
import { ScoreArc } from "./ScoreArc";
import { ReadingTimeline } from "./ReadingTimeline";
import { MinisRow } from "./MinisRow";
import { YourWords } from "./YourWords";
import { computeMinis, computeScoreArc, computeTimeline } from "./derivedStats";
import type { AuthorBook, PromptAnswer, QueuedEntry, RankingInfo, WeeselRow } from "./types";

export const dynamic = "force-dynamic";

async function getAuthor(id: number): Promise<{ id: number; name: string; photo_url: string | null } | null> {
  const { rows } = await pool.query(`select id::int as id, name, photo_url from authors where id = $1`, [id]);
  return rows[0] ?? null;
}

async function getAuthorBooks(authorId: number): Promise<AuthorBook[]> {
  const { rows } = await pool.query<AuthorBook>(
    `select book_id, title, cover_url, score::float8 as score, year_read, year_released,
            word_count::float8 as word_count, page_count,
            avg_pages_per_day::float8 as avg_pages_per_day, review, legacy_notes,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books
     where author_id = $1 and date_finished is not null
     order by date_finished asc`,
    [authorId]
  );
  return rows;
}

async function getRankings(bookIds: number[]): Promise<Record<number, RankingInfo>> {
  if (bookIds.length === 0) return {};
  const { rows } = await pool.query<{ book_id: number; rank: number; year: number; total: number }>(
    `select br.book_id, br.rank, br.year, cnt.total
     from book_rankings br
     join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
       on cnt.list_id = br.list_id
     where br.book_id = any($1)`,
    [bookIds]
  );
  const map: Record<number, RankingInfo> = {};
  for (const r of rows) map[r.book_id] = { rank: r.rank, year: r.year, total: r.total };
  return map;
}

async function getPromptAnswers(bookIds: number[]): Promise<PromptAnswer[]> {
  if (bookIds.length === 0) return [];
  const { rows } = await pool.query<PromptAnswer>(
    `select pa.book_id, b.title as book_title, p.question, pa.answer
     from prompt_answers pa
     join prompts p on p.id = pa.prompt_id
     join books b on b.book_id = pa.book_id
     where pa.book_id = any($1)
     order by pa.answered_at asc`,
    [bookIds]
  );
  return rows;
}

async function getQueued(authorId: number): Promise<QueuedEntry[]> {
  const { rows } = await pool.query<QueuedEntry>(
    `select id, title, cover_url, word_count from tbr where author_id = $1 order by title asc`,
    [authorId]
  );
  return rows;
}

// Uses the same authoritative crediting as the /weesels Hall of Fame
// (creditedAuthorId, via the book's real author wherever a book_id is
// resolved) rather than matching the raw nominee/author_or_narrator text --
// that text field holds the *narrator* for Best Narration rows, which would
// otherwise silently miss those wins here.
async function getWeesels(authorId: number): Promise<WeeselRow[]> {
  const [rows, categories] = await Promise.all([getWeeselRows(), getCategories()]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  return rows
    .filter((r) => creditedAuthorId(r, categoryNameOf(r, categoriesById)) === authorId)
    .map((r) => ({ year: r.year, category: categoryNameOf(r, categoriesById), result: r.result }));
}

async function getRankByPages(authorId: number, totalPages: number): Promise<{ rank: number | null; totalAuthors: number }> {
  const { rows } = await pool.query<{ id: number; total_pages: number }>(
    `select a.id::int as id, coalesce(sum(b.page_count), 0)::int as total_pages
     from authors a
     left join books b on b.author_id = a.id and b.date_finished is not null
     group by a.id`
  );
  const sorted = [...rows].sort((a, b) => b.total_pages - a.total_pages);
  const rank = totalPages > 0 ? sorted.findIndex((r) => r.id === authorId) + 1 : null;
  return { rank: rank && rank > 0 ? rank : null, totalAuthors: rows.length };
}

async function getRankByScore(authorId: number, avgScore: number | null): Promise<{ rank: number | null; totalAuthors: number }> {
  const { rows } = await pool.query<{ id: number; avg_score: number }>(
    `select a.id::int as id, avg(b.score)::float8 as avg_score
     from authors a
     join books b on b.author_id = a.id and b.date_finished is not null
     group by a.id
     having avg(b.score) is not null`
  );
  const sorted = [...rows].sort((a, b) => b.avg_score - a.avg_score);
  const rank = avgScore != null ? sorted.findIndex((r) => r.id === authorId) + 1 : null;
  return { rank: rank && rank > 0 ? rank : null, totalAuthors: rows.length };
}

async function getGrandTotalPages(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `select coalesce(sum(page_count), 0)::int as total from books where date_finished is not null`
  );
  return rows[0].total;
}

export default async function AuthorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorId = Number(id);
  if (!Number.isInteger(authorId)) notFound();

  const author = await getAuthor(authorId);
  if (!author) notFound();

  const books = await getAuthorBooks(authorId);
  const bookIds = books.map((b) => b.book_id);

  const [rankings, promptAnswers, queued, weesels, grandTotalPages] = await Promise.all([
    getRankings(bookIds),
    getPromptAnswers(bookIds),
    getQueued(authorId),
    getWeesels(authorId),
    getGrandTotalPages(),
  ]);

  const totalPages = books.reduce((sum, b) => sum + b.page_count, 0);
  const totalWords = books.reduce((sum, b) => sum + (b.word_count ?? 0), 0);
  const scored = books.filter((b) => b.score != null);
  const avgScore = scored.length > 0 ? scored.reduce((sum, b) => sum + (b.score as number), 0) / scored.length : null;
  const finishedDates = books.map((b) => b.date_finished as string).sort();
  const firstRead = finishedDates[0] ?? null;
  const latestRead = finishedDates[finishedDates.length - 1] ?? null;

  const { rank: rankByPages, totalAuthors } = await getRankByPages(authorId, totalPages);
  const { rank: rankByScore, totalAuthors: totalAuthorsByScore } = await getRankByScore(authorId, avgScore);
  // Same percentile convention as the series/year-context stats elsewhere
  // (rankColor.ts): 1st of N is the 100th percentile, last is the 0th.
  const percentileByPages =
    rankByPages != null && totalAuthors > 1 ? 1 - (rankByPages - 1) / (totalAuthors - 1) : null;
  const percentileByScore =
    rankByScore != null && totalAuthorsByScore > 1 ? 1 - (rankByScore - 1) / (totalAuthorsByScore - 1) : null;
  const percentOfEverything = grandTotalPages > 0 ? (totalPages / grandTotalPages) * 100 : null;

  const today = new Date().toISOString().slice(0, 10);
  const minis = computeMinis(books, rankings, author.name, today);
  const scoreArc = computeScoreArc(books);
  const timeline = computeTimeline(books);

  if (books.length === 0) notFound();

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/authors" className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink">
          ← Authors
        </Link>

        <AuthorHeader
          author={author}
          booksCount={books.length}
          totalPages={totalPages}
          totalWords={totalWords}
          avgScore={avgScore}
          firstRead={firstRead}
          latestRead={latestRead}
          rankByPages={rankByPages}
          totalAuthors={totalAuthors}
          percentileByPages={percentileByPages}
          rankByScore={rankByScore}
          totalAuthorsByScore={totalAuthorsByScore}
          percentileByScore={percentileByScore}
          percentOfEverything={percentOfEverything}
          weesels={weesels}
        />

        <div>
          <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink`}>Bookshelf</h2>
          <Bookshelf books={books} rankings={rankings} />
        </div>

        {queued.length > 0 && <QueuedStrip entries={queued} />}

        {books.length >= 3 && (
          <div className="grid gap-6 sm:grid-cols-2">
            {scoreArc.length >= 3 && (
              <div className="rounded-2xl border border-hairline bg-card/40 p-5">
                <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink`}>Score arc</h2>
                <ScoreArc points={scoreArc} />
              </div>
            )}
            <div className="rounded-2xl border border-hairline bg-card/40 p-5">
              <h2 className={`${fraunces.className} mb-2 text-lg font-semibold text-ink`}>Reading timeline</h2>
              <ReadingTimeline points={timeline} />
            </div>
          </div>
        )}

        <MinisRow minis={minis} />

        <YourWords books={books} promptAnswers={promptAnswers} />
      </div>
    </div>
  );
}
