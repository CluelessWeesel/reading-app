import { pool } from "@/lib/db";
import { LibraryView } from "./LibraryView";
import type { Book } from "../shared/bookTypes";

export const dynamic = "force-dynamic";

async function getBooks(): Promise<Book[]> {
  const { rows } = await pool.query<Book>(
    `select book_id, title, author, series, genre, year_read,
            year_released, format_raw, format_type, page_count, narrator,
            reread, isbn, status, cover_url, review,
            series_number::float8 as series_number,
            score::float8 as score,
            word_count::float8 as word_count,
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

export default async function LibraryPage() {
  const [books, allGenres] = await Promise.all([getBooks(), getGenres()]);
  return <LibraryView books={books} allGenres={allGenres} />;
}
