import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { capacityFor } from "@/app/rankings/tiers/tierMath";
import { ALL_TIERS, PLACEABLE_TIERS } from "@/app/rankings/tiers/types";
import type { TierId } from "@/app/rankings/tiers/types";

const VALID_TIERS = new Set<string>(ALL_TIERS);
const PLACEABLE = new Set<string>(PLACEABLE_TIERS);

type TierRow = {
  book_id: number;
  position: number;
  title: string;
  author: string | null;
  author_id: number | null;
  cover_url: string | null;
  score: number | null;
};

async function getTierRows(client: PoolClient, tier: TierId): Promise<TierRow[]> {
  const { rows } = await client.query<TierRow>(
    `select bt.book_id, bt.position, b.title, b.author, b.author_id::int as author_id, b.cover_url, b.score::float8 as score
     from book_tiers bt
     join books b on b.book_id = bt.book_id
     where bt.tier = $1
     order by bt.position asc`,
    [tier]
  );
  return rows;
}

async function getCapacityPercent(client: PoolClient, tier: TierId): Promise<number> {
  const { rows } = await client.query<{ value: string }>(`select value from app_settings where key = $1`, [
    `tier_capacity_${tier.toLowerCase()}`,
  ]);
  return rows[0] ? Number(rows[0].value) : 0;
}

// Every finished book, not just the ones that already have a book_tiers
// row -- during the opening fill this is what keeps capacity at its true,
// mature value from the very first placement instead of ramping up from
// zero as the fill progresses (a book placed on day one deserves the same
// S capacity as one placed on the last day). Once the fill is complete
// this is exactly equal to the book_tiers row count anyway, since every
// finished book has exactly one row by then and Phase 3 keeps it that way.
async function getTotalPlaced(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `select count(*)::int as n from books where date_finished is not null`
  );
  return rows[0].n;
}

async function getFillCompleted(client: PoolClient): Promise<boolean> {
  const { rows } = await client.query<{ value: string }>(`select value from app_settings where key = 'tier_fill_completed'`);
  return rows[0]?.value === "true";
}

// Upserts an entire tier's order in one go rather than computing a single
// insertion index server-side -- the caller (drag-drop or the fill flow)
// already knows the exact final order it wants, so this just persists it.
// on conflict covers both "this book already has a row" (a real move) and
// "this is the book's very first tier row" (fresh finish or fill
// placement) with the same statement.
async function upsertOrder(client: PoolClient, tier: TierId, orderedBookIds: number[]): Promise<void> {
  for (let i = 0; i < orderedBookIds.length; i++) {
    await client.query(
      `insert into book_tiers (book_id, tier, position) values ($1, $2, $3)
       on conflict (book_id) do update set tier = excluded.tier, position = excluded.position`,
      [orderedBookIds[i], tier, i]
    );
  }
}

// Handles every way a book lands somewhere on the tier board: the opening
// fill's one-tap placement (to_index omitted -> append), ordinary
// drag-and-drop (to_index from the drop position), and a displaced-book
// swap when the target tier is already at capacity. Whether this logs to
// tier_moves is decided purely from the server's own tier_fill_completed
// setting, never from anything the client claims -- the fill's own
// placements and every move afterward go through this exact same code
// path, so there's only one place capacity/logging rules can drift.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { book_id, to_tier, to_index, displaced_book_id, displaced_to_tier } = body as Record<string, unknown>;

  if (!Number.isInteger(book_id)) {
    return NextResponse.json({ error: "book_id is required." }, { status: 400 });
  }
  if (typeof to_tier !== "string" || !VALID_TIERS.has(to_tier)) {
    return NextResponse.json({ error: "to_tier must be one of S, A, B, C, D, holding." }, { status: 400 });
  }
  const toTier = to_tier as TierId;
  const bookId = book_id as number;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: currentRows } = await client.query<{ tier: TierId }>(
      `select tier from book_tiers where book_id = $1 for update`,
      [bookId]
    );
    const fromTier: TierId | null = currentRows[0]?.tier ?? null;
    const enteringNewTier = fromTier !== toTier;

    const toTierRows = await getTierRows(client, toTier);
    const toTierBookIds = toTierRows.map((r) => r.book_id).filter((id) => id !== bookId);

    if (PLACEABLE.has(toTier) && enteringNewTier && displaced_book_id == null) {
      const percent = await getCapacityPercent(client, toTier);
      const totalPlaced = await getTotalPlaced(client);
      const capacity = capacityFor(percent, totalPlaced);
      if (toTierBookIds.length >= capacity) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "tier-full", tier: toTier, capacity, current: toTierRows },
          { status: 409 }
        );
      }
    }

    let displacedTargetTier: TierId | null = null;
    if (typeof displaced_book_id === "number") {
      const idx = toTierBookIds.indexOf(displaced_book_id);
      if (idx === -1) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Displaced book is not currently in the target tier." }, { status: 400 });
      }
      displacedTargetTier =
        typeof displaced_to_tier === "string" && VALID_TIERS.has(displaced_to_tier)
          ? (displaced_to_tier as TierId)
          : "holding";
      toTierBookIds.splice(idx, 1);
    }

    const insertIndex =
      typeof to_index === "number" && Number.isInteger(to_index)
        ? Math.max(0, Math.min(toTierBookIds.length, to_index))
        : toTierBookIds.length;
    toTierBookIds.splice(insertIndex, 0, bookId);

    const fillCompleted = await getFillCompleted(client);

    await upsertOrder(client, toTier, toTierBookIds);

    if (fromTier && fromTier !== toTier) {
      const fromRows = await getTierRows(client, fromTier);
      const fromIds = fromRows.map((r) => r.book_id).filter((id) => id !== bookId);
      await upsertOrder(client, fromTier, fromIds);
    }

    if (typeof displaced_book_id === "number" && displacedTargetTier) {
      const destRows = await getTierRows(client, displacedTargetTier);
      const destIds = [...destRows.map((r) => r.book_id), displaced_book_id];
      await upsertOrder(client, displacedTargetTier, destIds);
      if (fillCompleted) {
        await client.query(`insert into tier_moves (book_id, from_tier, to_tier) values ($1, $2, $3)`, [
          displaced_book_id,
          toTier,
          displacedTargetTier,
        ]);
      }
    }

    if (fillCompleted) {
      await client.query(`insert into tier_moves (book_id, from_tier, to_tier) values ($1, $2, $3)`, [
        bookId,
        fromTier,
        toTier,
      ]);
    }

    await client.query("COMMIT");

    const affectedTiers = new Set<TierId>([toTier]);
    if (fromTier && fromTier !== toTier) affectedTiers.add(fromTier);
    if (displacedTargetTier) affectedTiers.add(displacedTargetTier);

    const affected: Partial<Record<TierId, TierRow[]>> = {};
    for (const tier of affectedTiers) affected[tier] = await getTierRows(client, tier);

    return NextResponse.json({ ok: true, affected });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to place book." }, { status: 500 });
  } finally {
    client.release();
  }
}
