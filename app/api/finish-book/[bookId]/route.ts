import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { computeAvgPagesPerDay } from "@/app/shared/avgPagesPerDay";
import { daysBetweenInclusive } from "@/app/shared/isoDate";

// Housekeeping for completing the ceremony: status='read', year_read
// derived from date_finished (defaulting to today if somehow still unset),
// removed from current_books. Also stamps avg_pages_per_day using the same
// method as the historical spreadsheet-era backfill (see
// app/shared/avgPagesPerDay.ts) so books finished going forward stay
// comparable to the rest of the reading history. Returns updated year
// totals for the closing screen (the client already knows ranking
// placement, pages/words, and days-taken from earlier ceremony steps --
// this is the one thing that needs a fresh aggregate query).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: bookRows } = await client.query(
      `select to_char(coalesce(date_finished, current_date), 'YYYY-MM-DD') as date_finished,
              to_char(date_started, 'YYYY-MM-DD') as date_started,
              word_count::float8 as word_count
       from books where book_id = $1 for update`,
      [bookIdNum]
    );
    if (bookRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const dateFinished: string = bookRows[0].date_finished;
    const dateStarted: string | null = bookRows[0].date_started;
    const wordCount: number | null = bookRows[0].word_count;
    const yearRead = Number(dateFinished.slice(0, 4));
    const daysTaken = dateStarted != null ? daysBetweenInclusive(dateStarted, dateFinished) : 0;
    const avgPagesPerDay = computeAvgPagesPerDay(wordCount, daysTaken);

    await client.query(
      `update books set status = 'read', year_read = $1, date_finished = $2, avg_pages_per_day = $3 where book_id = $4`,
      [yearRead, dateFinished, avgPagesPerDay, bookIdNum]
    );
    await client.query(`delete from current_books where book_id = $1`, [bookIdNum]);

    const { rows: totalRows } = await client.query(
      `select count(*)::int as books, coalesce(sum(page_count), 0)::int as pages
       from books where year_read = $1`,
      [yearRead]
    );

    await client.query("COMMIT");
    return NextResponse.json({
      year_read: yearRead,
      date_finished: dateFinished,
      year_totals: totalRows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to finish book." }, { status: 500 });
  } finally {
    client.release();
  }
}
