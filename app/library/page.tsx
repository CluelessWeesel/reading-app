import { pool } from "@/lib/db";
import { LibraryView } from "./LibraryView";
import type { Book } from "./types";

export const dynamic = "force-dynamic";

async function getBooks(): Promise<Book[]> {
  const { rows } = await pool.query<Book>(
    `select book_id, title, author, series, genre, year_read,
            year_released, format_type, page_count, isbn, cover_url,
            series_number::float8 as series_number,
            score::float8 as score,
            word_count::float8 as word_count,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books
     order by title asc`
  );
  return rows;
}

export default async function LibraryPage() {
  const books = await getBooks();
  return <LibraryView books={books} />;
}
