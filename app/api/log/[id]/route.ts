import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Fixes a mistaken day's page count. current_books.position is the running
// total of every day's pages (converted to percent for audio via page_count),
// so correcting a past day has to shift position by the same delta -- not
// touching it here used to mean an edited day's pages and the book's current
// page silently disagreed. This is the one edit path for a day already on
// the books, so it always adjusts an existing day, never creates one.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const pages = (body as Record<string, unknown> | null)?.pages;
  if (typeof pages !== "number" || !Number.isFinite(pages) || !Number.isInteger(pages) || pages < 0) {
    return NextResponse.json({ error: "Pages must be a non-negative whole number." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      `select book_id, pages from daily_reading where id = $1 for update`,
      [idNum]
    );
    if (existingRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }
    const { book_id: bookId, pages: oldPages } = existingRows[0];
    const pagesDelta = pages - oldPages;

    let newPosition: number | null = null;

    if (bookId != null && pagesDelta !== 0) {
      const { rows: cbRows } = await client.query<{
        position: number;
        format_type: string | null;
        page_count: number | null;
      }>(
        `select cb.position::float8 as position, b.format_type, b.page_count
         from current_books cb join books b on b.book_id = cb.book_id
         where cb.book_id = $1
         for update`,
        [bookId]
      );

      if (cbRows.length > 0) {
        const { position: currentPosition, format_type: formatType, page_count: pageCount } = cbRows[0];

        let positionDelta = pagesDelta;
        if (formatType === "audio") {
          if (pageCount == null) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { error: "This audio book has no page count set, so its position can't be adjusted." },
              { status: 400 }
            );
          }
          positionDelta = (pagesDelta / pageCount) * 100;
        }

        newPosition = currentPosition + positionDelta;
        if (newPosition < 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "That would put the position below zero." }, { status: 400 });
        }

        await client.query(`update current_books set position = $1 where book_id = $2`, [newPosition, bookId]);
      }
    }

    const { rows } = await client.query(
      `update daily_reading set pages = $1 where id = $2
       returning id, book_id, pages, to_char(date, 'YYYY-MM-DD') as date`,
      [pages, idNum]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ...rows[0], position: newPosition });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  } finally {
    client.release();
  }
}
