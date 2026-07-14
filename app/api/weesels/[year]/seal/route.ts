import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Seals a year: every confirmed-running category must already have a
// winner, then this is the one permanent action that flips
// /weesels/[year] live and starts crown propagation everywhere else.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: sealedRows } = await client.query(`select 1 from weesel_years where year = $1`, [year]);
    if (sealedRows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This year is already sealed." }, { status: 409 });
    }

    // A year with zero weesels rows never had a ceremony run at all -- the
    // "every confirmed category has a winner" check below is vacuously true
    // for such a year (there's nothing to group), so it needs its own guard.
    const { rows: anyRows } = await client.query(`select 1 from weesels where year = $1 limit 1`, [year]);
    if (anyRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No ceremony has been run for this year yet." }, { status: 400 });
    }

    const { rows: unrevealed } = await client.query(
      `select w.category_id, count(*) filter (where w.result = 'winner') as winners
       from weesels w
       where w.year = $1
       group by w.category_id
       having count(*) filter (where w.result = 'winner') = 0`,
      [year]
    );
    if (unrevealed.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Not every confirmed category has a winner yet." },
        { status: 400 }
      );
    }

    await client.query(`insert into weesel_years (year) values ($1)`, [year]);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to seal year." }, { status: 500 });
  } finally {
    client.release();
  }
}
