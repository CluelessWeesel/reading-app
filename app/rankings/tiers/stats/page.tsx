import { pool } from "@/lib/db";
import { todayLocalIso } from "@/app/shared/isoDate";
import { PLACEABLE_TIERS } from "../types";
import type { Capacities } from "../types";
import { TierStatsView } from "./TierStatsView";
import type { SeriesParent, TierMoveFull, TierStatBook } from "./types";

export const dynamic = "force-dynamic";

async function getPlacedBooks(): Promise<TierStatBook[]> {
  const { rows } = await pool.query<TierStatBook>(
    `select b.book_id, b.title, b.cover_url, bt.tier, to_char(bt.placed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as placed_at,
            b.author, b.author_id::int as author_id, b.series, b.genre, b.format_type,
            b.year_released, b.year_read, b.page_count, b.word_count::float8 as word_count,
            b.avg_pages_per_day::float8 as avg_pages_per_day, b.score::float8 as score,
            to_char(b.date_started, 'YYYY-MM-DD') as date_started,
            to_char(b.date_finished, 'YYYY-MM-DD') as date_finished
     from book_tiers bt
     join books b on b.book_id = bt.book_id`
  );
  return rows;
}

async function getSettings(): Promise<{ capacities: Capacities; fillCompleted: boolean }> {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `select key, value from app_settings where key like 'tier_%'`
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const capacities = {} as Capacities;
  for (const tier of PLACEABLE_TIERS) capacities[tier] = Number(map[`tier_capacity_${tier.toLowerCase()}`] ?? 0);
  return { capacities, fillCompleted: map.tier_fill_completed === "true" };
}

// Full history, not just the board's 12-month window -- volatility,
// stability, evictions, and the superlatives corner all need every move
// that's ever happened, and ascending order makes the eviction-pairing
// heuristic (see movementStatsMath.ts) and per-book "current tier since"
// lookups easy to build in one linear pass.
async function getAllTierMoves(): Promise<TierMoveFull[]> {
  const { rows } = await pool.query<TierMoveFull>(
    `select tm.id, tm.book_id, b.title, b.cover_url, b.score::float8 as score, tm.from_tier, tm.to_tier,
            to_char(tm.moved_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') as moved_at
     from tier_moves tm
     join books b on b.book_id = tm.book_id
     order by tm.moved_at asc, tm.id asc`
  );
  return rows;
}

async function getTotalFinished(): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`select count(*)::int as n from books where date_finished is not null`);
  return rows[0].n;
}

async function getSeriesParents(): Promise<SeriesParent[]> {
  const { rows } = await pool.query<SeriesParent>(`select series, parent_series from series`);
  return rows;
}

export default async function TierStatsPage() {
  const settings = await getSettings();

  if (!settings.fillCompleted) {
    return (
      <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm text-ink-warm-faint">
            Finish the opening tier fill first — stats will appear once the board is seeded.
          </p>
        </div>
      </div>
    );
  }

  const [books, moves, totalFinished, seriesParents] = await Promise.all([
    getPlacedBooks(),
    getAllTierMoves(),
    getTotalFinished(),
    getSeriesParents(),
  ]);

  return (
    <TierStatsView
      books={books}
      moves={moves}
      capacities={settings.capacities}
      totalFinished={totalFinished}
      seriesParents={seriesParents}
      today={todayLocalIso()}
    />
  );
}
