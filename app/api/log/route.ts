import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logForwardProgress } from "@/lib/logPosition";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

type EntryResult = { book_id: number; ok: boolean; error?: string; delta?: number };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).entries)) {
    return NextResponse.json({ error: "Expected { entries: [...] }" }, { status: 400 });
  }

  // The client sends its own local calendar date rather than relying on
  // Postgres's current_date, which reflects the DB session's timezone (UTC
  // on Supabase) -- for timezones ahead of UTC that rolls over hours after
  // local midnight, silently misdating anything logged that morning.
  const date = (body as Record<string, unknown>).date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Expected a date in YYYY-MM-DD format." }, { status: 400 });
  }

  const entries = (body as { entries: unknown[] }).entries;
  const results: EntryResult[] = [];

  for (const raw of entries) {
    const entry = raw as Record<string, unknown>;
    const bookId = Number(entry.book_id);
    const newPosition = Number(entry.position);

    if (!Number.isInteger(bookId) || !isFiniteNumber(newPosition)) {
      results.push({ book_id: bookId, ok: false, error: "Invalid book_id or position." });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: cbRows } = await client.query(
        `select cb.position::float8 as position, b.format_type, b.page_count
         from current_books cb join books b on b.book_id = cb.book_id
         where cb.book_id = $1
         for update`,
        [bookId]
      );
      if (cbRows.length === 0) {
        await client.query("ROLLBACK");
        results.push({ book_id: bookId, ok: false, error: "Not currently reading this book." });
        continue;
      }

      const { position: currentPosition, format_type: formatType, page_count: pageCount } = cbRows[0];

      if (newPosition < currentPosition) {
        await client.query("ROLLBACK");
        results.push({
          book_id: bookId,
          ok: false,
          error: `Position can't go backwards (currently ${currentPosition}).`,
        });
        continue;
      }

      const result = await logForwardProgress(
        client,
        bookId,
        newPosition,
        currentPosition,
        formatType,
        pageCount,
        date
      );
      if (!result.ok) {
        await client.query("ROLLBACK");
        results.push({ book_id: bookId, ok: false, error: result.error });
        continue;
      }

      await client.query("COMMIT");
      results.push({ book_id: bookId, ok: true, delta: result.delta });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      results.push({ book_id: bookId, ok: false, error: "Failed to save." });
    } finally {
      client.release();
    }
  }

  const { rows: totalRows } = await pool.query(
    `select coalesce(sum(pages), 0)::int as total from daily_reading where date = $1`,
    [date]
  );

  return NextResponse.json({ results, today_total: totalRows[0].total });
}
