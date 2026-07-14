import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { year, rank, book_id, title, score, had_star } = body as Record<string, unknown>;

  if (!isFiniteNumber(year) || !Number.isInteger(year)) {
    return NextResponse.json({ error: "year must be a whole number." }, { status: 400 });
  }
  if (!isFiniteNumber(rank) || !Number.isInteger(rank) || rank < 1) {
    return NextResponse.json({ error: "rank must be a positive whole number." }, { status: 400 });
  }
  if (!isFiniteNumber(book_id)) {
    return NextResponse.json({ error: "book_id is required." }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: listRows } = await client.query(
      `select distinct list_id from book_rankings where year = $1 limit 1`,
      [year]
    );
    const listId: string = listRows[0]?.list_id ?? `year-${year}`;

    // Idempotent re-placement: if this book already has a slot (e.g. the user went
    // back and changed their pick), remove it first and close the gap, so re-running
    // this endpoint never leaves a duplicate row for the same book.
    const { rows: existingRows } = await client.query(
      `delete from book_rankings where list_id = $1 and book_id = $2 returning rank`,
      [listId, book_id]
    );
    if (existingRows.length > 0) {
      await client.query(
        `update book_rankings set rank = rank - 1 where list_id = $1 and rank > $2`,
        [listId, existingRows[0].rank]
      );
    }

    // Deferred unique(list_id, rank) constraint lets this multi-row shift
    // land consistently -- see migration 0010.
    await client.query(
      `update book_rankings set rank = rank + 1 where list_id = $1 and rank >= $2`,
      [listId, rank]
    );

    await client.query(
      `insert into book_rankings (list_id, rank, title, book_id, score, had_star, year)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [listId, rank, title.trim(), book_id, score ?? null, Boolean(had_star), year]
    );

    const oldRank: number | null = existingRows[0]?.rank ?? null;
    if (oldRank !== rank) {
      await client.query(
        `insert into rank_changes (book_id, year, old_rank, new_rank) values ($1, $2, $3, $4)`,
        [book_id, year, oldRank, rank]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ list_id: listId, rank }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to insert ranking." }, { status: 500 });
  } finally {
    client.release();
  }
}

// Un-ranks a book (e.g. the ceremony's Ranking step being skipped after the
// user went Back and had previously placed it). No-op if it has no slot.
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { year, book_id } = body as Record<string, unknown>;
  if (!isFiniteNumber(year) || !Number.isInteger(year)) {
    return NextResponse.json({ error: "year must be a whole number." }, { status: 400 });
  }
  if (!isFiniteNumber(book_id)) {
    return NextResponse.json({ error: "book_id is required." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: listRows } = await client.query(
      `select distinct list_id from book_rankings where year = $1 limit 1`,
      [year]
    );
    const listId: string | undefined = listRows[0]?.list_id;

    if (listId) {
      const { rows: existingRows } = await client.query(
        `delete from book_rankings where list_id = $1 and book_id = $2 returning rank`,
        [listId, book_id]
      );
      if (existingRows.length > 0) {
        await client.query(
          `update book_rankings set rank = rank - 1 where list_id = $1 and rank > $2`,
          [listId, existingRows[0].rank]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to unrank." }, { status: 500 });
  } finally {
    client.release();
  }
}
