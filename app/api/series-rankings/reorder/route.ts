import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { SERIES_LIST_NAMES } from "@/app/rankings/types";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Moves an already-ranked series to a new position within its list. Every
// series_rankings row is always ranked (no unranked state), so -- unlike
// book-rankings, which has a separate /insert for brand-new placements --
// this is the only mutation reordering ever needs.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { list_name, series, rank } = body as Record<string, unknown>;

  if (typeof list_name !== "string" || !SERIES_LIST_NAMES.includes(list_name as (typeof SERIES_LIST_NAMES)[number])) {
    return NextResponse.json({ error: "Invalid list_name." }, { status: 400 });
  }
  if (typeof series !== "string" || !series.trim()) {
    return NextResponse.json({ error: "series is required." }, { status: 400 });
  }
  if (!isFiniteNumber(rank) || !Number.isInteger(rank) || rank < 1) {
    return NextResponse.json({ error: "rank must be a positive whole number." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      `delete from series_rankings where list_name = $1 and series = $2
       returning rank, status_flag`,
      [list_name, series]
    );
    if (existingRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Series is not in that list." }, { status: 404 });
    }
    const { rank: oldRank, status_flag: statusFlag } = existingRows[0];

    await client.query(
      `update series_rankings set rank = rank - 1 where list_name = $1 and rank > $2`,
      [list_name, oldRank]
    );
    // Deferred unique(list_name, rank) constraint lets this multi-row shift
    // land consistently -- see migration 0022.
    await client.query(
      `update series_rankings set rank = rank + 1 where list_name = $1 and rank >= $2`,
      [list_name, rank]
    );

    await client.query(
      `insert into series_rankings (list_name, rank, series, status_flag) values ($1, $2, $3, $4)`,
      [list_name, rank, series, statusFlag]
    );

    if (oldRank !== rank) {
      await client.query(
        `insert into series_rank_changes (list_name, series, old_rank, new_rank) values ($1, $2, $3, $4)`,
        [list_name, series, oldRank, rank]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ rank });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to reorder." }, { status: 500 });
  } finally {
    client.release();
  }
}
