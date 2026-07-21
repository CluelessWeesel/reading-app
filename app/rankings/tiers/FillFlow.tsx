"use client";

import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { capacityFor, totalPlacedFromBoard } from "./tierMath";
import { SwapPicker } from "./SwapPicker";
import { PLACEABLE_TIERS, ALL_TIERS } from "./types";
import type { Capacities, QueueBook, TierBoardData, TierBook, TierId } from "./types";

type PendingSwap = { bookId: number; title: string; toTier: TierId; tier: TierId; current: TierBook[] };

// The one-off opening ceremony: deals every already-finished book one at a
// time (highest-scored first, so the top tiers get real candidates early),
// resumable across visits since the "queue" is really just "every finished
// book without a book_tiers row yet" recomputed fresh on each page load.
// Placements here go through the exact same /api/tier-board/place endpoint
// the live board uses -- the server (not this component) is what keeps
// them out of tier_moves, by checking tier_fill_completed itself.
export function FillFlow({
  initialQueue,
  initialBoard,
  capacities,
  onDone,
}: {
  initialQueue: QueueBook[];
  initialBoard: TierBoardData;
  capacities: Capacities;
  onDone: () => void;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [board, setBoard] = useState(initialBoard);
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [totalEligible] = useState(() => initialQueue.length + totalPlacedFromBoard(initialBoard));

  const current = queue[0] ?? null;
  const placedSoFar = totalEligible - queue.length;

  async function place(toTier: TierId, displaced?: { bookId: number; toTier: TierId }): Promise<boolean> {
    if (!current) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tier-board/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: current.book_id,
          to_tier: toTier,
          displaced_book_id: displaced?.bookId,
          displaced_to_tier: displaced?.toTier,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "tier-full") {
        setPendingSwap({ bookId: current.book_id, title: current.title, toTier, tier: data.tier, current: data.current });
        return false;
      }
      if (!res.ok) throw new Error(data.error || "Placement failed.");

      setBoard((prev) => {
        const next: TierBoardData = { ...prev };
        for (const tier of ALL_TIERS) {
          if (data.affected[tier]) next[tier] = data.affected[tier];
        }
        return next;
      });

      const nextQueue = queue.slice(1);
      setQueue(nextQueue);
      if (nextQueue.length === 0) await finishFill();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Placement failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finishFill() {
    await fetch("/api/tier-board/complete-fill", { method: "POST" });
    setDone(true);
  }

  async function confirmSwap(displacedBookId: number, displacedToTier: TierId) {
    if (!pendingSwap) return;
    const ok = await place(pendingSwap.toTier, { bookId: displacedBookId, toTier: displacedToTier });
    if (ok) setPendingSwap(null);
  }

  if (done) {
    return (
      <div className="story-theme-night story-card-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-ink-warm">
        <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">Your board is set</p>
        <h1 className={`${fraunces.className} mt-3 text-3xl font-semibold text-gold-ink sm:text-4xl`}>
          {board.S.length} in S, {board.A.length} in A, {board.B.length} in B, {board.C.length} in C, {board.D.length} in D
        </h1>
        <p className="mt-2 text-sm opacity-70">{board.holding.length} still sitting in Holding.</p>
        <button
          type="button"
          onClick={onDone}
          className="mt-8 rounded-full bg-accent px-8 py-3 text-base font-semibold text-on-accent shadow-sm"
        >
          View your board
        </button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="story-theme-night story-card-bg fixed inset-0 z-50 flex flex-col text-ink-warm">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-8">
        <p className="text-xs uppercase tracking-wide opacity-60">
          {placedSoFar} of {totalEligible} placed
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <CoverThumb title={current.title} coverUrl={current.cover_url} className="aspect-[2/3] w-48 shadow-2xl sm:w-56" />
        <h2 className={`${fraunces.className} mt-6 text-2xl font-semibold sm:text-3xl`}>{current.title}</h2>
        {current.author && <p className="mt-1 text-sm opacity-70">{current.author}</p>}
        {current.score != null && <p className="mt-1 text-xs opacity-50">Scored {current.score.toFixed(2)}</p>}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>

      <div className="px-4 pb-8 sm:px-8">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-2 sm:grid-cols-7">
          {PLACEABLE_TIERS.map((tier) => {
            const capacity = capacityFor(capacities[tier], totalEligible);
            const slotsLeft = capacity - board[tier].length;
            return (
              <button
                key={tier}
                type="button"
                disabled={saving}
                onClick={() => place(tier)}
                className="flex flex-col items-center gap-1 rounded-xl border border-gold bg-black/20 py-3 text-center transition hover:bg-black/30 disabled:opacity-50"
              >
                <span className={`${fraunces.className} text-xl font-semibold`}>{tier}</span>
                <span className="text-[10px] opacity-60">{slotsLeft > 0 ? `${slotsLeft} left` : "full"}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => place("holding")}
          className="mx-auto mt-3 block rounded-full border border-gold px-6 py-2 text-sm text-ink-warm-muted transition hover:text-ink-warm disabled:opacity-50"
        >
          Skip -- decide later
        </button>
      </div>

      {pendingSwap && (
        <SwapPicker
          tier={pendingSwap.tier}
          current={pendingSwap.current}
          incomingTitle={pendingSwap.title}
          onConfirm={confirmSwap}
          onCancel={() => setPendingSwap(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
