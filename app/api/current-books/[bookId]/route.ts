import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

const FORMAT_TYPES = new Set(["audio", "physical", "ebook"]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Update reading position and/or fix a mistaken format_type.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { position, format_type } = body as Record<string, unknown>;

  if (position !== undefined && (!isFiniteNumber(position) || position < 0)) {
    return NextResponse.json({ error: "Position must be a non-negative number." }, { status: 400 });
  }
  if (format_type !== undefined && (typeof format_type !== "string" || !FORMAT_TYPES.has(format_type))) {
    return NextResponse.json({ error: "Format type must be audio, physical, or ebook." }, { status: 400 });
  }

  if (position === undefined && format_type === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  if (position !== undefined) {
    const { rowCount } = await pool.query(
      `update current_books set position = $1 where book_id = $2`,
      [position, bookIdNum]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "Not currently reading this book." }, { status: 404 });
    }
  }
  if (format_type !== undefined) {
    await pool.query(`update books set format_type = $1 where book_id = $2`, [format_type, bookIdNum]);
  }

  const { rows } = await pool.query(
    `select
       cb.book_id, cb.position::float8 as position,
       b.title, b.author, b.format_type, b.page_count,
       b.word_count::float8 as word_count, b.cover_url,
       to_char(b.date_started, 'YYYY-MM-DD') as date_started
     from current_books cb
     join books b on b.book_id = cb.book_id
     where cb.book_id = $1`,
    [bookIdNum]
  );
  return NextResponse.json(rows[0]);
}

// Abandon a start entirely: delete the books row (cascades to current_books).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const { rowCount } = await pool.query(`delete from books where book_id = $1`, [bookIdNum]);
  if (rowCount === 0) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  return NextResponse.json({ book_id: bookIdNum });
}
