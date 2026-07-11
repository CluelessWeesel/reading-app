import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 5 && Math.round(v * 2) === v * 2;
}

// Individually-skippable radar ratings: only rated (non-null-score)
// categories are sent, each upserted; skipped categories simply never get a
// row here.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray((body as Record<string, unknown>).ratings)) {
    return NextResponse.json({ error: "Expected { ratings: [...] }" }, { status: 400 });
  }
  const ratings = (body as { ratings: unknown[] }).ratings;

  for (const raw of ratings) {
    const r = raw as Record<string, unknown>;
    if (typeof r.category !== "string" || !r.category.trim() || !isValidScore(r.score)) {
      return NextResponse.json(
        { error: "Each rating needs a category and a score between 0.5 and 5 in steps of 0.5." },
        { status: 400 }
      );
    }
  }

  try {
    for (const raw of ratings) {
      const r = raw as { category: string; score: number };
      await pool.query(
        `insert into book_ratings (book_id, category, score)
         values ($1, $2, $3)
         on conflict (book_id, category) do update set score = excluded.score`,
        [bookIdNum, r.category, r.score]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "23503") {
      return NextResponse.json({ error: "Unknown rating category." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}
