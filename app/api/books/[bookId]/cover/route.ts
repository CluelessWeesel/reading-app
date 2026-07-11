import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

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
  if (!body || typeof body !== "object" || !("cover_url" in body)) {
    return NextResponse.json({ error: "Expected { cover_url }" }, { status: 400 });
  }

  const raw = (body as { cover_url: unknown }).cover_url;
  const coverUrl = raw === null || raw === undefined ? null : String(raw).trim() || null;

  const { rowCount } = await pool.query(
    `update books set cover_url = $1 where book_id = $2`,
    [coverUrl, bookIdNum]
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json({ book_id: bookIdNum, cover_url: coverUrl });
}
