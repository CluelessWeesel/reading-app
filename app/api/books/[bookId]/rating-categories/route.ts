import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Deals the 3 universal rating categories plus whatever extras this book's
// genre's template pulls in (genre -> genres.template -> rating_templates).
// Also returns the full category list so a dealt slot can be swapped for
// any other category.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const { rows: bookRows } = await pool.query(
    `select genre from books where book_id = $1`,
    [bookIdNum]
  );
  if (bookRows.length === 0) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  const genre: string | null = bookRows[0].genre;

  const { rows: universalRows } = await pool.query(
    `select category from rating_categories where scope = 'universal' order by category`
  );
  const universal = universalRows.map((r) => r.category as string);

  let extras: string[] = [];
  if (genre) {
    const { rows: extraRows } = await pool.query(
      `select rt.category
       from genres g
       join rating_templates rt on rt.template = g.template
       where g.genre = $1
       order by rt.category`,
      [genre]
    );
    extras = extraRows.map((r) => r.category as string);
  }

  const { rows: allRows } = await pool.query(`select category from rating_categories order by category`);
  const all = allRows.map((r) => r.category as string);

  return NextResponse.json({
    dealt: [...universal, ...extras],
    all,
  });
}
