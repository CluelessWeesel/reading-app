import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Lightweight library listing for BookCombobox's own default fetch (any
// caller that doesn't already have a books array loaded -- gateways,
// ceremony, etc.). last_activity is the most recent date this book was
// touched at all (finished, started, or logged against), driving the
// combobox's recency-weighted "before you type" suggestions -- a book
// mid-read today should outrank one finished a year ago.
export async function GET() {
  const { rows } = await pool.query(
    `select b.book_id as id, b.title, b.author, b.cover_url, b.genre, b.subgenre,
            b.word_count::float8 as word_count, b.page_count,
            to_char(
              greatest(b.date_finished, b.date_started, (select max(dr.date) from daily_reading dr where dr.book_id = b.book_id)),
              'YYYY-MM-DD'
            ) as last_activity
     from books b
     order by title asc`
  );
  return NextResponse.json(rows);
}
