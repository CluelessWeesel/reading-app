import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Housekeeping for completing the ceremony: status='read', year_read
// derived from date_finished (defaulting to today if somehow still unset),
// removed from current_books. Returns updated year totals for the closing
// screen (the client already knows ranking placement, pages/words, and
// days-taken from earlier ceremony steps -- this is the one thing that
// needs a fresh aggregate query).
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
      `select to_char(coalesce(date_finished, current_date), 'YYYY-MM-DD') as date_finished
       from books where book_id = $1 for update`,
      [bookIdNum]
    );
    if (bookRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const dateFinished: string = bookRows[0].date_finished;
    const yearRead = Number(dateFinished.slice(0, 4));

    await client.query(
      `update books set status = 'read', year_read = $1, date_finished = $2 where book_id = $3`,
      [yearRead, dateFinished, bookIdNum]
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
