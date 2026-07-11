import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Fixes a mistaken day's page count. Deliberately does NOT touch
// current_books.position -- position is independently authoritative (the
// last position you explicitly entered), not derived from summing
// daily_reading, so correcting history here has no cascading effects.
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

  const { rows, rowCount } = await pool.query(
    `update daily_reading set pages = $1 where id = $2
     returning id, book_id, pages, to_char(date, 'YYYY-MM-DD') as date`,
    [pages, idNum]
  );
  if (rowCount === 0) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
