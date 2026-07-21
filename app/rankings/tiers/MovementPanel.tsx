"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { TIER_ORDER, monthsAgoIso } from "./movementMath";
import type { TierId, TierMove } from "./types";

function tierLabel(tier: TierId): string {
  return tier === "holding" ? "Holding" : tier;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function MoveRow({ move }: { move: TierMove }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <CoverThumb title={move.title} coverUrl={move.cover_url} className="aspect-[2/3] w-7 shrink-0" />
      <Link href={`/books/${move.book_id}`} className="min-w-0 flex-1 truncate text-sm text-ink-warm hover:underline">
        {move.title}
      </Link>
      <span className="shrink-0 text-xs text-ink-warm-faint">
        {move.from_tier == null ? "Entered" : tierLabel(move.from_tier)} → {tierLabel(move.to_tier)}
      </span>
      <span className="shrink-0 text-xs text-ink-warm-faint">{shortDate(move.moved_at)}</span>
    </div>
  );
}

// Recent moves are just the latest N events, unfiltered. Climbers/fallers
// only ever consider genuine re-placements (from_tier not null -- see
// getReclassifications), ranked by the Holding-below-D ordinal in
// movementMath, over whichever window is selected.
export function MovementPanel({ recentMoves, reclassifications }: { recentMoves: TierMove[]; reclassifications: TierMove[] }) {
  const [months, setMonths] = useState<6 | 12>(6);

  const { climbers, fallers } = useMemo(() => {
    const cutoff = monthsAgoIso(months);
    const inWindow = reclassifications
      .filter((m) => m.moved_at >= cutoff && m.from_tier != null)
      .map((m) => ({ move: m, delta: TIER_ORDER[m.to_tier] - TIER_ORDER[m.from_tier as TierId] }));
    return {
      climbers: inWindow.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
      fallers: inWindow.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    };
  }, [reclassifications, months]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <h2 className={`${fraunces.className} mb-2 text-sm font-semibold text-ink-warm`}>Recent moves</h2>
        {recentMoves.length === 0 ? (
          <p className="text-xs text-ink-warm-faint">No moves yet.</p>
        ) : (
          <div className="divide-y divide-gold">
            {recentMoves.map((m) => (
              <MoveRow key={m.id} move={m} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className={`${fraunces.className} text-sm font-semibold text-ink-warm`}>Climbers &amp; fallers</h2>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Climbers</p>
            {climbers.length === 0 ? (
              <p className="text-xs text-ink-warm-faint">None in this window.</p>
            ) : (
              <div className="divide-y divide-gold">
                {climbers.map((c) => (
                  <MoveRow key={c.move.id} move={c.move} />
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
                  <MoveRow key={f.move.id} move={f.move} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
