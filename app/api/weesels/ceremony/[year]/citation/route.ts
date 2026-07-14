import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Adds or edits a winner's citation, independent of the reveal moment
// itself -- the reveal flow explicitly allows skipping this for later.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { category_id, citation } = body as Record<string, unknown>;
  if (!isFiniteNumber(category_id)) {
    return NextResponse.json({ error: "category_id is required." }, { status: 400 });
  }
  if (citation !== null && typeof citation !== "string") {
    return NextResponse.json({ error: "citation must be a string or null." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: sealedRows } = await client.query(`select 1 from weesel_years where year = $1`, [year]);
    if (sealedRows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This year is sealed." }, { status: 409 });
    }

    const { rowCount } = await client.query(
      `update weesels set citation = $1 where year = $2 and category_id = $3 and result = 'winner'`,
      [citation, year, category_id]
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No winner set for this category yet." }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to update citation." }, { status: 500 });
  } finally {
    client.release();
  }
}
