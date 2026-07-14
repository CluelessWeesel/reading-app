import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Moves an already-ranked book to a new position within its year's list.
// Unlike /api/book-rankings/insert (which needs the client to resupply
// title/score/had_star for a brand-new placement), this only ever touches a
// row that already exists -- so those fields are read back from the row
// being moved rather than trusted from the request body.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { year, book_id, rank } = body as Record<string, unknown>;

  if (!isFiniteNumber(year) || !Number.isInteger(year)) {
    return NextResponse.json({ error: "year must be a whole number." }, { status: 400 });
  }
  if (!isFiniteNumber(book_id)) {
    return NextResponse.json({ error: "book_id is required." }, { status: 400 });
  }
  if (!isFiniteNumber(rank) || !Number.isInteger(rank) || rank < 1) {
    return NextResponse.json({ error: "rank must be a positive whole number." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: listRows } = await client.query(
      `select distinct list_id from book_rankings where year = $1 limit 1`,
      [year]
    );
    const listId: string | undefined = listRows[0]?.list_id;
    if (!listId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No ranked list exists for that year." }, { status: 404 });
    }

    const { rows: existingRows } = await client.query(
      `delete from book_rankings where list_id = $1 and book_id = $2
       returning rank, title, score, had_star`,
      [listId, book_id]
    );
    if (existingRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Book is not ranked for that year." }, { status: 404 });
    }
    const { rank: oldRank, title, score, had_star } = existingRows[0];

    await client.query(
      `update book_rankings set rank = rank - 1 where list_id = $1 and rank > $2`,
      [listId, oldRank]
    );
    // Deferred unique(list_id, rank) constraint lets this multi-row shift
    // land consistently -- see migration 0010.
    await client.query(
      `update book_rankings set rank = rank + 1 where list_id = $1 and rank >= $2`,
      [listId, rank]
    );

    await client.query(
      `insert into book_rankings (list_id, rank, title, book_id, score, had_star, year)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [listId, rank, title, book_id, score, had_star, year]
    );

    if (oldRank !== rank) {
      await client.query(
        `insert into rank_changes (book_id, year, old_rank, new_rank) values ($1, $2, $3, $4)`,
        [book_id, year, oldRank, rank]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ list_id: listId, rank });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to reorder." }, { status: 500 });
  } finally {
    client.release();
  }
}
