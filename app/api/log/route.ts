import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { computePagesDelta } from "@/app/shared/positionMath";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

type EntryResult = { book_id: number; ok: boolean; error?: string; delta?: number };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).entries)) {
    return NextResponse.json({ error: "Expected { entries: [...] }" }, { status: 400 });
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

      // If this book was already logged today, back out today's already-
      // recorded pages to find the position baseline as of yesterday --
      // otherwise re-logging the same book twice today would double-count.
      const { rows: todayRows } = await client.query(
        `select pages from daily_reading where date = current_date and book_id = $1`,
        [bookId]
      );
      const alreadyLoggedToday = todayRows[0]?.pages ?? 0;
      const baseline = currentPosition - alreadyLoggedToday;

      const delta = computePagesDelta(newPosition, baseline, formatType, pageCount);
      if (delta === null) {
        await client.query("ROLLBACK");
        results.push({
          book_id: bookId,
          ok: false,
          error: "This audio book has no page count set, so pages can't be computed from percent yet.",
        });
        continue;
      }

      await client.query(
        `insert into daily_reading (date, book_id, pages)
         values (current_date, $1, $2)
         on conflict (date, book_id) do update set pages = excluded.pages`,
        [bookId, delta]
      );
      await client.query(`update current_books set position = $1 where book_id = $2`, [
        newPosition,
        bookId,
      ]);

      await client.query("COMMIT");
      results.push({ book_id: bookId, ok: true, delta });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      results.push({ book_id: bookId, ok: false, error: "Failed to save." });
    } finally {
      client.release();
    }
  }

  const { rows: totalRows } = await pool.query(
    `select coalesce(sum(pages), 0)::int as total from daily_reading where date = current_date`
  );

  return NextResponse.json({ results, today_total: totalRows[0].total });
}
