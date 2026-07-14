import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Post-seal-only corrections: swap a category's winner among its existing
// nominees, or edit its citation -- never re-opens eligibility or adds new
// nominees. Always requires a reason, logged permanently in
// weesel_amendments, applied in the same transaction as the change.
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
  const { category_id, action, reason, new_winner_weesel_id, new_citation } = body as Record<string, unknown>;

  if (!isFiniteNumber(category_id)) {
    return NextResponse.json({ error: "category_id is required." }, { status: 400 });
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "A written reason is required to amend a sealed year." }, { status: 400 });
  }
  if (action !== "change-winner" && action !== "edit-citation") {
    return NextResponse.json({ error: "action must be 'change-winner' or 'edit-citation'." }, { status: 400 });
  }
  if (action === "change-winner" && !isFiniteNumber(new_winner_weesel_id)) {
    return NextResponse.json({ error: "new_winner_weesel_id is required for change-winner." }, { status: 400 });
  }
  if (action === "edit-citation" && typeof new_citation !== "string") {
    return NextResponse.json({ error: "new_citation is required for edit-citation." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: sealedRows } = await client.query(`select 1 from weesel_years where year = $1`, [year]);
    if (sealedRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Amendments only apply to sealed years." }, { status: 409 });
    }

    if (action === "change-winner") {
      const { rows: candidateRows } = await client.query(
        `select id from weesels where id = $1 and year = $2 and category_id = $3`,
        [new_winner_weesel_id, year, category_id]
      );
      if (candidateRows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "That nominee doesn't belong to this category/year." }, { status: 400 });
      }
      await client.query(
        `update weesels set result = 'nominee' where year = $1 and category_id = $2 and result = 'winner'`,
        [year, category_id]
      );
      await client.query(`update weesels set result = 'winner' where id = $1`, [new_winner_weesel_id]);
    } else {
      const { rowCount } = await client.query(
        `update weesels set citation = $1 where year = $2 and category_id = $3 and result = 'winner'`,
        [new_citation, year, category_id]
      );
      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No winner set for this category." }, { status: 404 });
      }
    }

    await client.query(
      `insert into weesel_amendments (year, category_id, reason) values ($1, $2, $3)`,
      [year, category_id, reason.trim()]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to apply amendment." }, { status: 500 });
  } finally {
    client.release();
  }
}
