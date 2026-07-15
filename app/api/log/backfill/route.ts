import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { computePagesDelta } from "@/app/shared/positionMath";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

type EntryResult = { book_id: number; ok: boolean; error?: string; days_written?: number };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).date !== "string" ||
    typeof (body as Record<string, unknown>).today !== "string" ||
    !Array.isArray((body as Record<string, unknown>).entries)
  ) {
    return NextResponse.json({ error: "Expected { date, today, entries: [...] }" }, { status: 400 });
  }

  const targetDate = (body as { date: string }).date;
  // The client's own local calendar date, not Postgres's current_date --
  // see app/api/log/route.ts for why current_date (UTC on Supabase) is wrong
  // for a timezone ahead of UTC.
  const today = (body as { today: string }).today;
  const entries = (body as { entries: unknown[] }).entries;

  if (targetDate >= today) {
    return NextResponse.json({ error: "Backfill date must be before today." }, { status: 400 });
  }
  const results: EntryResult[] = [];

  for (const raw of entries) {
    const entry = raw as Record<string, unknown>;
    const bookId = Number(entry.book_id);
    const newPosition = Number(entry.position);
    const spread = entry.spread === "single" ? "single" : "even";

    if (!Number.isInteger(bookId) || !isFiniteNumber(newPosition)) {
      results.push({ book_id: bookId, ok: false, error: "Invalid book_id or position." });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: cbRows } = await client.query(
        `select cb.position::float8 as position, b.format_type, b.page_count,
                to_char(b.date_started, 'YYYY-MM-DD') as date_started
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
      const { position: currentPosition, format_type: formatType, page_count: pageCount, date_started: dateStarted } =
        cbRows[0];

      const { rows: lastLogRows } = await client.query(
        `select to_char(max(date), 'YYYY-MM-DD') as last_date from daily_reading where book_id = $1`,
        [bookId]
      );
      const lastLogDate: string | null = lastLogRows[0]?.last_date ?? null;

      // First day needing an entry: the day after the last log, or the
      // start date itself if this book has never been logged at all.
      const { rows: rangeStartRows } = await client.query(
        lastLogDate
          ? `select to_char($1::date + interval '1 day', 'YYYY-MM-DD') as range_start`
          : `select $1::text as range_start`,
        [lastLogDate ?? dateStarted]
      );
      const rangeStart: string = rangeStartRows[0].range_start;

      if (targetDate < rangeStart) {
        await client.query("ROLLBACK");
        results.push({
          book_id: bookId,
          ok: false,
          error: `Date must be on or after ${rangeStart} for this book.`,
        });
        continue;
      }
      if (newPosition < currentPosition) {
        await client.query("ROLLBACK");
        results.push({
          book_id: bookId,
          ok: false,
          error: `Position can't go backwards (currently ${currentPosition}).`,
        });
        continue;
      }

      const totalDelta = computePagesDelta(newPosition, currentPosition, formatType, pageCount);
      if (totalDelta === null) {
        await client.query("ROLLBACK");
        results.push({
          book_id: bookId,
          ok: false,
          error: "This audio book has no page count set, so pages can't be computed from percent yet.",
        });
        continue;
      }

      const { rows: dayRows } = await client.query(
        `select to_char(d, 'YYYY-MM-DD') as day
         from generate_series($1::date, $2::date, interval '1 day') as d`,
        [rangeStart, targetDate]
      );
      const days: string[] = dayRows.map((r) => r.day);
      const n = days.length;

      let daysToWrite: { date: string; pages: number }[];
      if (n === 1) {
        daysToWrite = [{ date: days[0], pages: totalDelta }];
      } else if (spread === "single") {
        daysToWrite = [{ date: targetDate, pages: totalDelta }];
      } else {
        const base = Math.floor(totalDelta / n);
        const remainder = totalDelta - base * n;
        daysToWrite = days.map((date, i) => ({ date, pages: base + (i < remainder ? 1 : 0) }));
      }

      for (const day of daysToWrite) {
        await client.query(
          `insert into daily_reading (date, book_id, pages)
           values ($1, $2, $3)
           on conflict (date, book_id) do update set pages = excluded.pages`,
          [day.date, bookId, day.pages]
        );
      }
      await client.query(`update current_books set position = $1 where book_id = $2`, [
        newPosition,
        bookId,
      ]);

      await client.query("COMMIT");
      results.push({ book_id: bookId, ok: true, days_written: daysToWrite.length });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      results.push({ book_id: bookId, ok: false, error: "Failed to save." });
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ results });
}
