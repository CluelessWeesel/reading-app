import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Sets (or, pre-seal, re-sets) a category's winner for this year. Any other
// row in the same category/year currently marked 'winner' is reset back to
// 'nominee' first -- lets you freely change your mind before sealing
// without going through the post-seal amendment flow.
export async function POST(request: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { category_id, winner_weesel_id, citation } = body as Record<string, unknown>;
  if (!isFiniteNumber(category_id)) {
    return NextResponse.json({ error: "category_id is required." }, { status: 400 });
  }
  if (!isFiniteNumber(winner_weesel_id)) {
    return NextResponse.json({ error: "winner_weesel_id is required." }, { status: 400 });
  }
  if (citation !== undefined && citation !== null && typeof citation !== "string") {
    return NextResponse.json({ error: "citation must be a string." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: sealedRows } = await client.query(`select 1 from weesel_years where year = $1`, [year]);
    if (sealedRows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This year is sealed." }, { status: 409 });
    }

    const { rows: winnerRows } = await client.query(
      `select id from weesels where id = $1 and year = $2 and category_id = $3`,
      [winner_weesel_id, year, category_id]
    );
    if (winnerRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That nominee doesn't belong to this category/year." }, { status: 400 });
    }

    await client.query(
      `update weesels set result = 'nominee' where year = $1 and category_id = $2 and result = 'winner' and id != $3`,
      [year, category_id, winner_weesel_id]
    );
    await client.query(
      `update weesels set result = 'winner', citation = coalesce($1, citation) where id = $2`,
      [typeof citation === "string" ? citation : null, winner_weesel_id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to reveal winner." }, { status: 500 });
  } finally {
    client.release();
  }
}
