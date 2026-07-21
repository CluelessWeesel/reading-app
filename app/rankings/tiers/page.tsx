import { pool } from "@/lib/db";
import { TierBoardShell } from "./TierBoardShell";
import { PLACEABLE_TIERS } from "./types";
import { computeDisagreements } from "./scoreVsTierMath";
import type { ScoreVsTierRow } from "./scoreVsTierMath";
import type { Capacities, QueueBook, TierBoardData, TierId, TierMove } from "./types";

export const dynamic = "force-dynamic";

type BoardRow = {
  book_id: number;
  tier: TierId;
  position: number;
  title: string;
  author: string | null;
  author_id: number | null;
  cover_url: string | null;
  score: number | null;
};

async function getBoard(): Promise<TierBoardData> {
  const { rows } = await pool.query<BoardRow>(
    `select bt.book_id, bt.tier, bt.position, b.title, b.author, b.author_id::int as author_id,
            b.cover_url, b.score::float8 as score
     from book_tiers bt
     join books b on b.book_id = bt.book_id
     order by bt.tier, bt.position asc`
  );
  const board: TierBoardData = { S: [], A: [], B: [], C: [], D: [], E: [], F: [], holding: [] };
  for (const r of rows) {
    board[r.tier].push({
      book_id: r.book_id,
      title: r.title,
      author: r.author,
      author_id: r.author_id,
      cover_url: r.cover_url,
      score: r.score,
      position: r.position,
    });
  }
  return board;
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

// Ordered highest-scored first -- the opening fill wants real, judgment-
// worthy candidates reaching S/A early rather than working through the
// library in whatever order it happens to be stored. Unscored books sort
// last but are still included (skippable straight to Holding). Within a
// tied score, the order is random, not reading order -- otherwise books
// finished close together (a series binge, say) would surface back-to-back
// and bias the early placements toward whatever mood that stretch was in.
async function getUnfilledQueue(): Promise<QueueBook[]> {
  const { rows } = await pool.query<QueueBook>(
    `select b.book_id, b.title, b.author, b.cover_url, b.score::float8 as score
     from books b
     where b.date_finished is not null
       and not exists (select 1 from book_tiers bt where bt.book_id = b.book_id)
     order by b.score desc nulls last, random()`
  );
  return rows;
}

// Latest N moves regardless of kind -- includes a book's very first entry
// onto the board (from_tier null), since "The Blade Itself entered Holding"
// is still a real, recent event worth showing.
async function getRecentMoves(limit = 20): Promise<TierMove[]> {
  const { rows } = await pool.query<TierMove>(
    `select tm.id, tm.book_id, b.title, b.cover_url, tm.from_tier, tm.to_tier,
            to_char(tm.moved_at, 'YYYY-MM-DD') as moved_at, tm.note
     from tier_moves tm
     join books b on b.book_id = tm.book_id
     order by tm.moved_at desc
     limit $1`,
    [limit]
  );
  return rows;
}

// Only genuine re-placements (from_tier not null) over the last year --
// the climbers/fallers panel filters this down to 6 vs 12 months client-
// side rather than re-querying, and a book's very first placement isn't a
// "climb" in the sense this panel means.
async function getReclassifications(): Promise<TierMove[]> {
  const { rows } = await pool.query<TierMove>(
    `select tm.id, tm.book_id, b.title, b.cover_url, tm.from_tier, tm.to_tier,
            to_char(tm.moved_at, 'YYYY-MM-DD') as moved_at, tm.note
     from tier_moves tm
     join books b on b.book_id = tm.book_id
     where tm.from_tier is not null and tm.moved_at >= now() - interval '12 months'
     order by tm.moved_at desc`
  );
  return rows;
}

async function getScoreVsTierRows(): Promise<ScoreVsTierRow[]> {
  const { rows } = await pool.query<ScoreVsTierRow>(
    `select b.book_id, b.title, b.cover_url, b.score::float8 as score, bt.tier
     from books b
     join book_tiers bt on bt.book_id = b.book_id
     where b.score is not null`
  );
  return rows;
}

export default async function TiersPage() {
  const [board, settings] = await Promise.all([getBoard(), getSettings()]);
  const queue = settings.fillCompleted ? [] : await getUnfilledQueue();
  const [recentMoves, reclassifications, scoreVsTierRows] = settings.fillCompleted
    ? await Promise.all([getRecentMoves(), getReclassifications(), getScoreVsTierRows()])
    : [[], [], []];
  const disagreements = computeDisagreements(scoreVsTierRows);

  return (
    <TierBoardShell
      initialBoard={board}
      capacities={settings.capacities}
      fillCompleted={settings.fillCompleted}
      initialQueue={queue}
      recentMoves={recentMoves}
      reclassifications={reclassifications}
      disagreements={disagreements}
    />
  );
}
