import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Replaces the whole set of watched categories for a book -- a shortlist,
// not a commitment, so this is just an idempotent "set these" rather than
// an append-only log.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray((body as Record<string, unknown>).category_ids)) {
    return NextResponse.json({ error: "Expected { category_ids: [...] }" }, { status: 400 });
  }
  const categoryIds = (body as { category_ids: unknown[] }).category_ids
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`delete from weesel_watchlist where book_id = $1`, [bookIdNum]);
    for (const categoryId of categoryIds) {
      await client.query(
        `insert into weesel_watchlist (book_id, category_id) values ($1, $2) on conflict do nothing`,
        [bookIdNum, categoryId]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  } finally {
    client.release();
  }
}
