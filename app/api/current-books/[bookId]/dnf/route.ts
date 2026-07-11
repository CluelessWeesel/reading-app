import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Mark DNF: the books row persists as a historical record (status='DNF'),
// but it stops being "currently reading".
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

    const { rowCount } = await client.query(
      `update books set status = 'DNF' where book_id = $1`,
      [bookIdNum]
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    await client.query(`delete from current_books where book_id = $1`, [bookIdNum]);

    await client.query("COMMIT");
    return NextResponse.json({ book_id: bookIdNum, status: "DNF" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to mark DNF." }, { status: 500 });
  } finally {
    client.release();
  }
}
