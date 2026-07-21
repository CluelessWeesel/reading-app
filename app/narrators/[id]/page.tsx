import { notFound } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { fraunces } from "@/app/shared/fonts";
import { getCategories, getWeeselRows } from "@/app/weesels/data";
import { categoryNameOf, creditedNarratorId } from "@/app/weesels/weeselMath";
import { todayLocalIso } from "@/app/shared/isoDate";
import { Bookshelf } from "@/app/authors/[id]/Bookshelf";
import { MinisRow } from "@/app/authors/[id]/MinisRow";
import { YourWords } from "@/app/authors/[id]/YourWords";
import { computeMinis } from "@/app/authors/[id]/derivedStats";
import type { AuthorBook, PromptAnswer, RankingInfo, WeeselRow } from "@/app/authors/[id]/types";
import { NarratorHeader } from "./NarratorHeader";

export const dynamic = "force-dynamic";

// Audiobook narration runs roughly 150 words/minute (~9,000 words/hour) --
// a fixed approximation, not a per-book tracked duration (this app doesn't
// track runtime), same spirit as the pace-chart's own AVG_WORDS_PER_PAGE
// constant for turning word counts into a comparable figure.
const WORDS_PER_HOUR = 9000;

async function getNarrator(id: number): Promise<{ id: number; name: string; photo_url: string | null } | null> {
  const { rows } = await pool.query(`select id::int as id, name, photo_url from narrators where id = $1`, [id]);
  return rows[0] ?? null;
}

// Mirrors authors/[id]'s getAuthorBooks, but joined through book_narrators
// (many-to-many) instead of a single books.author_id FK.
async function getNarratorBooks(narratorId: number): Promise<AuthorBook[]> {
  const { rows } = await pool.query<AuthorBook>(
    `select b.book_id, b.title, b.cover_url, b.score::float8 as score, b.year_read, b.year_released,
            b.word_count::float8 as word_count, b.page_count,
            b.avg_pages_per_day::float8 as avg_pages_per_day, b.review, b.legacy_notes,
            to_char(b.date_started, 'YYYY-MM-DD') as date_started,
            to_char(b.date_finished, 'YYYY-MM-DD') as date_finished
     from books b
     join book_narrators bn on bn.book_id = b.book_id
     where bn.narrator_id = $1 and b.date_finished is not null
     order by b.date_finished asc`,
    [narratorId]
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

// Only Best Narration is ever narrator-credited (see weeselMath.ts's
// creditedNarratorId) -- every other category stays author-credited, so
// this naturally only ever surfaces Best Narration honours for a narrator.
async function getWeesels(narratorId: number): Promise<WeeselRow[]> {
  const [rows, categories] = await Promise.all([getWeeselRows(), getCategories()]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  return rows
    .filter((r) => creditedNarratorId(r, categoryNameOf(r, categoriesById)) === narratorId)
    .map((r) => ({ year: r.year, category: categoryNameOf(r, categoriesById), result: r.result }));
}

async function getRankByPages(narratorId: number, totalPages: number): Promise<{ rank: number | null; totalNarrators: number }> {
  const { rows } = await pool.query<{ id: number; total_pages: number }>(
    `select n.id::int as id, coalesce(sum(b.page_count), 0)::int as total_pages
     from narrators n
     left join book_narrators bn on bn.narrator_id = n.id
     left join books b on b.book_id = bn.book_id and b.date_finished is not null
     group by n.id`
  );
  const sorted = [...rows].sort((a, b) => b.total_pages - a.total_pages);
  const rank = totalPages > 0 ? sorted.findIndex((r) => r.id === narratorId) + 1 : null;
  return { rank: rank && rank > 0 ? rank : null, totalNarrators: rows.length };
}

async function getGrandTotalPages(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `select coalesce(sum(page_count), 0)::int as total from books where date_finished is not null`
  );
  return rows[0].total;
}

export default async function NarratorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const narratorId = Number(id);
  if (!Number.isInteger(narratorId)) notFound();

  const narrator = await getNarrator(narratorId);
  if (!narrator) notFound();

  const books = await getNarratorBooks(narratorId);
  const bookIds = books.map((b) => b.book_id);

  const [rankings, promptAnswers, weesels, grandTotalPages] = await Promise.all([
    getRankings(bookIds),
    getPromptAnswers(bookIds),
    getWeesels(narratorId),
    getGrandTotalPages(),
  ]);

  const totalPages = books.reduce((sum, b) => sum + b.page_count, 0);
  const totalWords = books.reduce((sum, b) => sum + (b.word_count ?? 0), 0);
  const scored = books.filter((b) => b.score != null);
  const avgScore = scored.length > 0 ? scored.reduce((sum, b) => sum + (b.score as number), 0) / scored.length : null;
  const finishedDates = books.map((b) => b.date_finished as string).sort();
  const firstRead = finishedDates[0] ?? null;
  const latestRead = finishedDates[finishedDates.length - 1] ?? null;
  const hoursInYourEars = totalWords > 0 ? totalWords / WORDS_PER_HOUR : null;

  const { rank: rankByPages, totalNarrators } = await getRankByPages(narratorId, totalPages);
  const percentileByPages =
    rankByPages != null && totalNarrators > 1 ? 1 - (rankByPages - 1) / (totalNarrators - 1) : null;
  const percentOfEverything = grandTotalPages > 0 ? (totalPages / grandTotalPages) * 100 : null;

  const today = todayLocalIso();
  const minis = computeMinis(books, rankings, narrator.name, today);

  if (books.length === 0) notFound();

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/narrators"
          className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
        >
          ← Narrators
        </Link>

        <NarratorHeader
          narrator={narrator}
          booksCount={books.length}
          totalPages={totalPages}
          avgScore={avgScore}
          firstRead={firstRead}
          latestRead={latestRead}
          hoursInYourEars={hoursInYourEars}
          rankByPages={rankByPages}
          totalNarrators={totalNarrators}
          percentileByPages={percentileByPages}
          percentOfEverything={percentOfEverything}
          weesels={weesels}
        />

        <div>
          <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>Bookshelf</h2>
          <Bookshelf books={books} rankings={rankings} />
        </div>

        <MinisRow minis={minis} />

        <YourWords books={books} promptAnswers={promptAnswers} />
      </div>
    </div>
  );
}
