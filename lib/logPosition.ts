import type { PoolClient } from "pg";
import { computePagesDelta } from "@/app/shared/positionMath";

export type LogPositionResult =
  | { ok: true; delta: number }
  | { ok: false; status: number; error: string };

// Records forward reading progress: computes the pages delta since baseline
// (backing out anything already logged today so re-entering the same day
// doesn't double count), upserts today's daily_reading row, and updates
// current_books.position. Caller must already be inside a transaction and
// have confirmed newPosition > currentPosition before calling this -- this
// is the one code path that should ever write a daily_reading row from a
// position change, so both the quick-update button and the nightly /log
// flow route through it and stay consistent.
export async function logForwardProgress(
  client: PoolClient,
  bookId: number,
  newPosition: number,
  currentPosition: number,
  formatType: string | null,
  pageCount: number | null
): Promise<LogPositionResult> {
  const { rows: todayRows } = await client.query(
    `select pages from daily_reading where date = current_date and book_id = $1`,
    [bookId]
  );
  const alreadyLoggedToday = todayRows[0]?.pages ?? 0;
  const baseline = currentPosition - alreadyLoggedToday;

  const delta = computePagesDelta(newPosition, baseline, formatType, pageCount);
  if (delta === null) {
    return {
      ok: false,
      status: 400,
      error: "This audio book has no page count set, so pages can't be computed from percent yet.",
    };
  }

  await client.query(
    `insert into daily_reading (date, book_id, pages)
     values (current_date, $1, $2)
     on conflict (date, book_id) do update set pages = excluded.pages`,
    [bookId, delta]
  );
  await client.query(`update current_books set position = $1 where book_id = $2`, [newPosition, bookId]);

  return { ok: true, delta };
}
