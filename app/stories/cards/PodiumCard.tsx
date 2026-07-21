"use client";

import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import type { PodiumCardData, StoryMode } from "../types";

const REVEAL_ORDER: (1 | 2 | 3)[] = [3, 2, 1];
const PODIUM_LAYOUT: (1 | 2 | 3)[] = [2, 1, 3];
const HEIGHT_CLASS: Record<1 | 2 | 3, string> = { 1: "h-32", 2: "h-24", 3: "h-16" };

// Export mode captures one static frame, so it always shows fully revealed
// -- the tap-to-reveal drama only makes sense while someone's actually
// looking at the stacked/fullscreen card in real time.
export function PodiumCard({ card, mode }: { card: PodiumCardData; mode: StoryMode }) {
  const isStatic = mode === "export";
  const [revealed, setRevealed] = useState(isStatic ? card.entries.length : 0);

  const shownCount = isStatic ? card.entries.length : revealed;
  const canAdvance = !isStatic && shownCount < card.entries.length;
  const visibleRanks = new Set(REVEAL_ORDER.slice(0, shownCount));

  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-6 text-center ${canAdvance ? "cursor-pointer" : ""}`}
      onClick={() => canAdvance && setRevealed((r) => r + 1)}
      role={canAdvance ? "button" : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">The podium</p>

      <div className="flex items-end justify-center gap-4">
        {PODIUM_LAYOUT.map((rank) => {
          const entry = card.entries.find((e) => e.rank === rank);
          if (!entry) return null;
          const isVisible = visibleRanks.has(rank);
          return (
            <div
              key={rank}
              className={`flex flex-col items-center gap-2 transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0"}`}
            >
              <CoverThumb
                title={entry.title}
                coverUrl={entry.coverUrl}
                className={`aspect-[2/3] w-16 shadow-lg ${rank === 1 ? "ring-2 ring-gold-ink" : ""}`}
              />
              <p className={`${fraunces.className} max-w-[5rem] truncate text-xs font-medium`}>{entry.title}</p>
              <div className={`flex w-14 ${HEIGHT_CLASS[rank]} items-start justify-center rounded-t border border-gold bg-current/5 pt-1`}>
                <span className={`${fraunces.className} text-lg font-semibold text-gold-ink`}>{rank}</span>
              </div>
            </div>
          );
        })}
      </div>

      {canAdvance && <p className="text-xs italic opacity-50">Tap to reveal</p>}
      {!canAdvance && card.closingLine && <p className="text-sm italic opacity-70">{card.closingLine}</p>}
    </div>
  );
}
