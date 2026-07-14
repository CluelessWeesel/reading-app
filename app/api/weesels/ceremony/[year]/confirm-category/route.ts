import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MAX_NOMINEES } from "@/app/weesels/ceremony/constants";

type CandidateInput = {
  label: string;
  sublabel?: string | null;
  book_id?: number | null;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Freezes a category's candidate pool for this year -- writes the
// weesels nominee rows immediately (so later new finishes that would also
// qualify don't retroactively change an already-confirmed category) and
// marks it reviewed via weesel_ceremony_progress, whether or not it ended
// up with any candidates at all.
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
  const { category_id, candidates } = body as Record<string, unknown>;
  if (!isFiniteNumber(category_id)) {
    return NextResponse.json({ error: "category_id is required." }, { status: 400 });
  }
  if (!Array.isArray(candidates)) {
    return NextResponse.json({ error: "candidates must be an array." }, { status: 400 });
  }
  if (candidates.length > MAX_NOMINEES) {
    return NextResponse.json({ error: `A category can have at most ${MAX_NOMINEES} nominees.` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: sealedRows } = await client.query(`select 1 from weesel_years where year = $1`, [year]);
    if (sealedRows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This year is sealed." }, { status: 409 });
    }

    const { rows: existingProgress } = await client.query(
      `select 1 from weesel_ceremony_progress where year = $1 and category_id = $2`,
      [year, category_id]
    );
    if (existingProgress.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This category is already confirmed." }, { status: 409 });
    }

    const { rows: categoryRows } = await client.query<{ name: string }>(
      `select name from weesel_categories where id = $1`,
      [category_id]
    );
    const categoryName = categoryRows[0]?.name;
    if (!categoryName) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }

    // The legacy free-text `category` column (from before weesel_categories
    // existed) is still not-null -- kept in sync with the category name so
    // old readers of that column stay correct.
    for (const raw of candidates as CandidateInput[]) {
      if (typeof raw?.label !== "string" || !raw.label.trim()) continue;
      await client.query(
        `insert into weesels (year, category, category_id, book_id, nominee, author_or_narrator, result)
         values ($1, $2, $3, $4, $5, $6, 'nominee')`,
        [year, categoryName, category_id, raw.book_id ?? null, raw.label.trim(), raw.sublabel ?? null]
      );
    }

    await client.query(
      `insert into weesel_ceremony_progress (year, category_id) values ($1, $2)`,
      [year, category_id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to confirm category." }, { status: 500 });
  } finally {
    client.release();
  }
}
