import { pool } from "@/lib/db";
import { LibraryView } from "./LibraryView";
import type { Book } from "../shared/bookTypes";

export const dynamic = "force-dynamic";

async function getBooks(): Promise<Book[]> {
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
     from books
     where status is distinct from 'reading'
     order by title asc`
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
