import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query(
    `select
       cb.book_id, cb.position::float8 as position,
       b.title, b.author, b.series, b.genre, b.subgenre, b.year_released, b.year_read,
       b.format_raw, b.format_type, b.page_count, b.narrator, b.reread,
       b.isbn, b.status, b.cover_url, b.review, b.legacy_notes,
       b.series_number::float8 as series_number,
       b.score::float8 as score,
       b.word_count::float8 as word_count,
       b.predicted_score::float8 as predicted_score,
       b.predicted_margin::float8 as predicted_margin,
       to_char(b.date_started, 'YYYY-MM-DD') as date_started,
       to_char(b.date_finished, 'YYYY-MM-DD') as date_finished
     from current_books cb
     join books b on b.book_id = cb.book_id
     order by cb.id asc`
  );
  return NextResponse.json(rows);
}
