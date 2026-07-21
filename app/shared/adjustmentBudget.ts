import type { PoolClient } from "pg";

// A book counts once toward the 5-book cap no matter how many separate
// adjustment events (score and/or rank, one or several) touch it during
// the same year's window -- so the budget is the count of *distinct*
// book_ids across both change-log tables for that year, not a count of
// event rows. `reason is not null` is what marks a row as an adjustment
// event in the first place (see migration 0025).
export const ADJUSTMENT_LIMIT = 5;

export async function getAdjustmentUsedBookIds(client: PoolClient, year: number): Promise<Set<number>> {
  const { rows } = await client.query<{ book_id: number }>(
    `select book_id from rank_changes where year = $1 and reason is not null
     union
     select book_id from score_changes where year = $1 and reason is not null`,
    [year]
  );
  return new Set(rows.map((r) => r.book_id));
}
