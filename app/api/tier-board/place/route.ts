import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { capacityFor } from "@/app/rankings/tiers/tierMath";
import { ALL_TIERS, PLACEABLE_TIERS } from "@/app/rankings/tiers/types";
import type { TierId } from "@/app/rankings/tiers/types";

const VALID_TIERS = new Set<string>(ALL_TIERS);
const PLACEABLE = new Set<string>(PLACEABLE_TIERS);

// Every round trip to the DB here costs roughly the same fixed latency
// regardless of the query's own complexity (measured ~150ms/statement even
// for a trivial select) -- so the whole point of this file is minimizing
// the NUMBER of round trips, not how cheap each one is. Full book display
// data (title/author/cover/score) is deliberately never sent back: the
// client already holds it for every book on the board (loaded once on
// page mount, kept in sync locally), so the response only ever carries
// book_id ordering, and the client re-splices its own already-known
// objects into place.
async function getTierBookIds(client: PoolClient, tier: TierId): Promise<number[]> {
  const { rows } = await client.query<{ book_id: number }>(
    `select book_id from book_tiers where tier = $1 order by position asc`,
    [tier]
  );
  return rows.map((r) => r.book_id);
}

// tier_fill_completed and the target tier's capacity percentage in one
// round trip -- both are simple app_settings lookups, and fill-completed
// is needed on every call regardless of which branch runs.
async function getSettings(client: PoolClient, toTier: TierId): Promise<{ fillCompleted: boolean; capacityPercent: number }> {
  const { rows } = await client.query<{ key: string; value: string }>(
    `select key, value from app_settings where key = any($1)`,
    [["tier_fill_completed", `tier_capacity_${toTier.toLowerCase()}`]]
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    fillCompleted: map.tier_fill_completed === "true",
    capacityPercent: Number(map[`tier_capacity_${toTier.toLowerCase()}`] ?? 0),
  };
}

// Every finished book, not just the ones that already have a book_tiers
// row -- during the opening fill this is what keeps capacity at its true,
// mature value from the very first placement instead of ramping up from
// zero as the fill progresses (a book placed on day one deserves the same
// S capacity as one placed on the last day). Once the fill is complete
// this is exactly equal to the book_tiers row count anyway, since every
// finished book has exactly one row by then and Phase 3 keeps it that way.
// Only queried when a capacity check is actually needed.
async function getTotalPlaced(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `select count(*)::int as n from books where date_finished is not null`
  );
  return rows[0].n;
}

// Upserts an entire tier's order in one go via unnest() rather than one
// query per book (a per-book loop meant reordering within a big tier --
// C/D easily have 50+ books -- sent that many sequential round trips for a
// single drag-drop, which is what made a drop feel like it hung).
async function upsertOrder(client: PoolClient, tier: TierId, orderedBookIds: number[]): Promise<void> {
  if (orderedBookIds.length === 0) return;
  const tiers = orderedBookIds.map(() => tier);
  const positions = orderedBookIds.map((_, i) => i);
  await client.query(
    `insert into book_tiers (book_id, tier, position)
     select * from unnest($1::int[], $2::text[], $3::int[])
     on conflict (book_id) do update set tier = excluded.tier, position = excluded.position`,
    [orderedBookIds, tiers, positions]
  );
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
  const { book_id, to_tier, to_index, from_tier_hint, displaced_book_id, displaced_to_tier } = body as Record<string, unknown>;

  if (!Number.isInteger(book_id)) {
    return NextResponse.json({ error: "book_id is required." }, { status: 400 });
  }
  if (typeof to_tier !== "string" || !VALID_TIERS.has(to_tier)) {
    return NextResponse.json({ error: "to_tier must be one of S, A, B, C, D, E, F, holding." }, { status: 400 });
  }
  const toTier = to_tier as TierId;
  const bookId = book_id as number;
  // The client already knows which tier it dragged this book FROM -- used
  // purely as a fetch hint to fold that tier's rows into the same query as
  // toTier's, never trusted as the authoritative answer: the actual
  // from-tier is always read back off the locked rows themselves below, so
  // a stale/wrong hint only costs a fallback query, never a wrong result.
  const fromTierHint = typeof from_tier_hint === "string" && VALID_TIERS.has(from_tier_hint) ? (from_tier_hint as TierId) : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // `or book_id = $2` means this always finds the book's real current
    // tier regardless of whether from_tier_hint was right, wrong, or never
    // sent -- the hint only ever affects whether that tier's full sibling
    // list comes back in this same round trip (below) or needs one more
    // query later; it never affects correctness of fromTier itself.
    const tiersToLock = fromTierHint && fromTierHint !== toTier ? [toTier, fromTierHint] : [toTier];
    const { rows: lockedRows } = await client.query<{ book_id: number; tier: TierId; position: number }>(
      `select book_id, tier, position from book_tiers where tier = any($1) or book_id = $2 for update`,
      [tiersToLock, bookId]
    );

    const fromTier: TierId | null = lockedRows.find((r) => r.book_id === bookId)?.tier ?? null;
    let toTierBookIds = lockedRows
      .filter((r) => r.tier === toTier)
      .sort((a, b) => a.position - b.position)
      .map((r) => r.book_id)
      .filter((id) => id !== bookId);
    const fromTierBookIds =
      fromTier && fromTier !== toTier
        ? lockedRows
            .filter((r) => r.tier === fromTier)
            .sort((a, b) => a.position - b.position)
            .map((r) => r.book_id)
            .filter((id) => id !== bookId)
        : null;

    const { fillCompleted, capacityPercent } = await getSettings(client, toTier);
    const enteringNewTier = fromTier !== toTier;

    if (PLACEABLE.has(toTier) && enteringNewTier && displaced_book_id == null) {
      const totalPlaced = await getTotalPlaced(client);
      const capacity = capacityFor(capacityPercent, totalPlaced);
      if (toTierBookIds.length >= capacity) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "tier-full", tier: toTier, capacity }, { status: 409 });
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
      toTierBookIds = toTierBookIds.filter((id) => id !== displaced_book_id);
    }

    const insertIndex =
      typeof to_index === "number" && Number.isInteger(to_index)
        ? Math.max(0, Math.min(toTierBookIds.length, to_index))
        : toTierBookIds.length;
    toTierBookIds.splice(insertIndex, 0, bookId);

    await upsertOrder(client, toTier, toTierBookIds);

    let finalFromIds: number[] | null = null;
    if (fromTier && fromTier !== toTier) {
      finalFromIds = fromTierBookIds ?? (await getTierBookIds(client, fromTier)).filter((id) => id !== bookId);
      await upsertOrder(client, fromTier, finalFromIds);
    }

    let finalDestIds: number[] | null = null;
    if (typeof displaced_book_id === "number" && displacedTargetTier) {
      finalDestIds = [...(await getTierBookIds(client, displacedTargetTier)), displaced_book_id];
      await upsertOrder(client, displacedTargetTier, finalDestIds);
      if (fillCompleted) {
        await client.query(`insert into tier_moves (book_id, from_tier, to_tier) values ($1, $2, $3)`, [
          displaced_book_id,
          toTier,
          displacedTargetTier,
        ]);
      }
    }

    if (fillCompleted) {
      await client.query(`insert into tier_moves (book_id, from_tier, to_tier) values ($1, $2, $3)`, [bookId, fromTier, toTier]);
    }

    await client.query("COMMIT");

    const order: Partial<Record<TierId, number[]>> = { [toTier]: toTierBookIds };
    if (fromTier && fromTier !== toTier) order[fromTier] = finalFromIds ?? [];
    if (displacedTargetTier) order[displacedTargetTier] = finalDestIds ?? [];

    return NextResponse.json({ ok: true, order, fromTier, displacedTargetTier });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Failed to place book." }, { status: 500 });
  } finally {
    client.release();
  }
}
