"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "@/app/shared/fonts";
import { formatDateShort } from "@/app/shared/formatDateShort";
import { InfoTooltip } from "@/app/shared/InfoTooltip";
import { CoverThumb, EmptyState } from "@/app/stats/DistributionShared";
import { MoveRow } from "../MovementPanel";
import { tierLabel } from "../tierColors";
import type { TierMove } from "../types";
import {
  computeAvgTimeInCurrentTier,
  computeClimbersFallers,
  computeEvictions,
  computeNetFlow,
  computeStability,
  computeVolatility,
} from "./movementStatsMath";
import type { TierMoveFull, TierStatBook } from "./types";

// MoveRow (reused from the board's MovementPanel) formats moved_at as a
// plain date; this page's TierMoveFull carries a full timestamp (needed for
// eviction pairing), so this just trims it back down for display.
function asDisplayMove(m: TierMoveFull): TierMove {
  return { ...m, moved_at: m.moved_at.slice(0, 10), note: null };
}

export function MovementSection({ moves, books, today }: { moves: TierMoveFull[]; books: TierStatBook[]; today: string }) {
  const [months, setMonths] = useState<6 | 12>(6);

  const { climbers, fallers } = useMemo(() => computeClimbersFallers(moves, months), [moves, months]);
  const volatility = useMemo(() => computeVolatility(moves), [moves]);
  const stability = useMemo(() => computeStability(moves, books), [moves, books]);
  const timeInTier = useMemo(() => computeAvgTimeInCurrentTier(moves, books, today), [moves, books, today]);
  const evictions = useMemo(() => computeEvictions(moves), [moves]);
  const netFlow = useMemo(() => computeNetFlow(moves), [moves]);

  const hasMoves = moves.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Stability</p>
            <InfoTooltip text="% of currently-placed books that have never been genuinely reclassified since they entered the board -- a book's very first placement doesn't count as a reclassification, only a later move does." />
          </div>
          <p className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>{stability.stablePct.toFixed(0)}%</p>
          <p className="text-xs text-ink-warm-faint">
            {stability.stableCount} of {stability.total} never reclassified since entering
          </p>
        </div>
        <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Avg. time in current tier</p>
            <InfoTooltip text="Days since each book's most recent move into its current tier -- or since it first entered the board, if it's never moved since. Averaged across every placed book, then broken out per tier below." />
          </div>
          <p className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>
            {timeInTier.overallAvgDays != null ? `${Math.round(timeInTier.overallAvgDays)} days` : "—"}
          </p>
          <p className="truncate text-xs text-ink-warm-faint">
            {timeInTier.perTier
              .filter((t) => t.avgDays != null)
              .map((t) => `${tierLabel(t.tier)} ${Math.round(t.avgDays as number)}d`)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Climbers &amp; fallers</h3>
            <InfoTooltip text="Books that moved up or down a tier within the selected window. A book's first entry onto the board doesn't count as a climb or fall -- only a later reclassification does." />
          </div>
          <div className="flex gap-1">
            {([6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                aria-pressed={months === m}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  months === m ? "bg-accent text-on-accent" : "border border-gold text-ink-warm-faint hover:text-ink-warm"
                }`}
              >
                {m}mo
              </button>
            ))}
          </div>
        </div>
        {!hasMoves ? (
          <EmptyState message="Not enough history yet — this fills in once books start moving." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Climbers</p>
              {climbers.length === 0 ? (
                <p className="text-xs text-ink-warm-faint">None in this window.</p>
              ) : (
                <div className="divide-y divide-gold">
                  {climbers.map((c) => (
                    <MoveRow key={c.move.id} move={asDisplayMove(c.move)} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-red-600 dark:text-red-400">Fallers</p>
              {fallers.length === 0 ? (
                <p className="text-xs text-ink-warm-faint">None in this window.</p>
              ) : (
                <div className="divide-y divide-gold">
                  {fallers.map((f) => (
                    <MoveRow key={f.move.id} move={asDisplayMove(f.move)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Most-moved books</h3>
          <InfoTooltip text="Books ranked by total tier_moves history, all-time -- every kind of move counts (a first entry onto the board as well as later reclassifications), so this is a volatility ranking of how unsettled a book's placement has been, not just how many times it climbed or fell." />
        </div>
        {volatility.length === 0 ? (
          <EmptyState message="Not enough history yet — this fills in once books start moving." />
        ) : (
          <div className="divide-y divide-gold">
            {volatility.map((v) => (
              <div key={v.book_id} className="flex items-center gap-2.5 py-1.5">
                <CoverThumb title={v.title} coverUrl={v.cover_url} />
                <Link href={`/books/${v.book_id}`} className="min-w-0 flex-1 truncate text-sm text-ink-warm hover:underline">
                  {v.title}
                </Link>
                <span className="shrink-0 text-xs text-ink-warm-faint">
                  {v.moveCount} move{v.moveCount === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Evictions</h3>
          <InfoTooltip text="Inferred, not explicitly logged: a capacity-forced swap writes two move events at the exact same instant -- one for the book displaced out, one for the book entering. This list pairs those up wherever the displaced book was coming out of S or A." />
        </div>
        <p className="mb-2 text-xs text-ink-warm-faint">Books bumped out of S or A when capacity forced a choice.</p>
        {evictions.length === 0 ? (
          <EmptyState message="Not enough history yet — no capacity-forced swaps have happened." />
        ) : (
          <div className="divide-y divide-gold">
            {evictions.map((e) => (
              <div key={`${e.evictedBookId}-${e.movedAt}`} className="flex items-center gap-2.5 py-1.5">
                <CoverThumb title={e.evictedTitle} coverUrl={e.evictedCoverUrl} />
                <div className="min-w-0 flex-1">
                  <Link href={`/books/${e.evictedBookId}`} className="block truncate text-sm text-ink-warm hover:underline">
                    {e.evictedTitle}
                  </Link>
                  <p className="truncate text-xs text-ink-warm-faint">
                    {tierLabel(e.fromTier)} → {tierLabel(e.toTier)} · displaced by{" "}
                    <Link href={`/books/${e.displacedByBookId}`} className="hover:underline">
                      {e.displacedByTitle}
                    </Link>
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-warm-faint">{formatDateShort(e.movedAt.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Net flow between tiers</h3>
          <InfoTooltip text="Every from-tier -> to-tier reclassification, all-time, counted and ranked by how often it's happened. Green means that move is a climb, red means a fall. Moves in or out of Holding are shown but never colored -- Holding isn't part of the tier scale, so entering or leaving judgment isn't a climb or fall." />
        </div>
        {netFlow.length === 0 ? (
          <EmptyState message="Not enough history yet — this fills in once books start moving." />
        ) : (
          <ul className="space-y-1 text-xs">
            {netFlow.slice(0, 12).map((f) => (
              <li key={`${f.fromTier}-${f.toTier}`} className="flex items-center gap-2">
                <span
                  className={`font-medium ${
                    f.delta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : f.delta < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-ink-warm-faint"
                  }`}
                >
                  {tierLabel(f.fromTier)} → {tierLabel(f.toTier)}
                </span>
                <span className="text-ink-warm-faint">· {f.count} time{f.count === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
