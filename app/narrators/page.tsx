import { pool } from "@/lib/db";
import { NarratorsView } from "./NarratorsView";
import type { NarratorSummary } from "./types";

export const dynamic = "force-dynamic";

// Mirrors /authors' getAuthors, but joined through book_narrators (many-to-
// many -- a book can have more than one narrator, a narrator can narrate
// many books) instead of a single books.author_id FK.
async function getNarrators(): Promise<NarratorSummary[]> {
  const { rows } = await pool.query<NarratorSummary>(
    `select n.id::int as id, n.name, n.photo_url,
            count(b.book_id)::int as "booksCount",
            coalesce(sum(b.page_count), 0)::int as "totalPages",
            coalesce(sum(b.word_count), 0)::float8 as "totalWords",
            avg(b.score)::float8 as "avgScore",
            to_char(max(b.date_finished), 'YYYY-MM-DD') as "mostRecentFinish",
            coalesce(array_agg(distinct b.genre) filter (where b.genre is not null), '{}') as "genres"
     from narrators n
     left join book_narrators bn on bn.narrator_id = n.id
     left join books b on b.book_id = bn.book_id and b.date_finished is not null
     group by n.id, n.name, n.photo_url
     order by n.name asc`
  );
  return rows;
}

export default async function NarratorsPage() {
  const narrators = await getNarrators();
  return <NarratorsView narrators={narrators} />;
}
