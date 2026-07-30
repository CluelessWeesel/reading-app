import { pool } from "@/lib/db";
import { LibraryView } from "./LibraryView";
import type { Book } from "../shared/bookTypes";

export const dynamic = "force-dynamic";

async function getBooks(): Promise<Book[]> {
  const { rows } = await pool.query<Book>(
    `select b.book_id, b.title, b.author, b.author_id::int as author_id, b.series, b.genre, b.subgenre, b.year_read,
            b.year_released, b.format_raw, b.format_type, b.page_count, b.narrator,
            b.reread, b.isbn, b.status, b.cover_url, b.review, b.legacy_notes, b.indie,
            b.series_number::float8 as series_number,
            b.score::float8 as score,
            b.word_count::float8 as word_count,
            b.predicted_score::float8 as predicted_score,
            b.predicted_margin::float8 as predicted_margin,
            to_char(b.date_started, 'YYYY-MM-DD') as date_started,
            to_char(b.date_finished, 'YYYY-MM-DD') as date_finished,
            b.gateway_book_id, b.gateway_person, b.gateway_source, b.gateway_note,
            to_char(b.gateway_checked_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as gateway_checked_at,
            gb.title as gateway_book_title, gb.author as gateway_book_author, gb.cover_url as gateway_book_cover_url
     from books b
     left join books gb on gb.book_id = b.gateway_book_id
     where b.status is distinct from 'reading'
     order by b.title asc`
  );
  return rows;
}

async function getGenres(): Promise<string[]> {
  const { rows } = await pool.query<{ genre: string }>(
    `select genre from genres order by genre asc`
  );
  return rows.map((r) => r.genre);
}

// Subgenre is free text (no dedicated table like genre has), so its
// suggestion list is every distinct value already in use across both books
// and the TBR, not just the ones on the books currently loaded here.
async function getSubgenres(): Promise<string[]> {
  const { rows } = await pool.query<{ subgenre: string }>(
    `select distinct subgenre from (
       select subgenre from books where subgenre is not null
       union
       select subgenre from tbr where subgenre is not null
     ) s order by subgenre asc`
  );
  return rows.map((r) => r.subgenre);
}

export default async function LibraryPage() {
  const [books, allGenres, allSubgenres] = await Promise.all([getBooks(), getGenres(), getSubgenres()]);
  return <LibraryView books={books} allGenres={allGenres} allSubgenres={allSubgenres} />;
}
