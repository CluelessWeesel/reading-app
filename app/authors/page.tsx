import { pool } from "@/lib/db";
import { AuthorsView } from "./AuthorsView";
import type { AuthorSummary } from "./types";

export const dynamic = "force-dynamic";

async function getAuthors(): Promise<AuthorSummary[]> {
  const { rows } = await pool.query<AuthorSummary>(
    `select a.id::int as id, a.name, a.photo_url,
            count(b.book_id)::int as "booksCount",
            coalesce(sum(b.page_count), 0)::int as "totalPages",
            coalesce(sum(b.word_count), 0)::float8 as "totalWords",
            avg(b.score)::float8 as "avgScore",
            to_char(max(b.date_finished), 'YYYY-MM-DD') as "mostRecentFinish",
            coalesce(array_agg(distinct b.genre) filter (where b.genre is not null), '{}') as "genres",
            exists (select 1 from tbr t where t.author_id = a.id) as "hasQueued"
     from authors a
     left join books b on b.author_id = a.id and b.date_finished is not null
     group by a.id, a.name, a.photo_url
     order by a.name asc`
  );
  return rows;
}

export default async function AuthorsPage() {
  const authors = await getAuthors();
  return <AuthorsView authors={authors} />;
}
