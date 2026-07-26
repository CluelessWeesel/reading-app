"use client";

import { useMemo } from "react";
import { RecordCard } from "@/app/stats/RecordCard";
import {
  fastestRiser,
  heldEveryTier,
  highestScoredInHolding,
  longestServingS,
  mostRecentEviction,
} from "./superlativesMath";
import type { TierMoveFull, TierStatBook } from "./types";

export function SuperlativesSection({ books, moves, today }: { books: TierStatBook[]; moves: TierMoveFull[]; today: string }) {
  const records = useMemo(
    () => [
      { label: "Longest-serving S", description: "The S-tier book that's held its spot the longest.", result: longestServingS(books, moves, today) },
      { label: "Fastest riser", description: "The single biggest jump in one move, not a cumulative climb.", result: fastestRiser(moves) },
      { label: "Held every tier", description: "A book that's visited all seven placeable tiers at some point.", result: heldEveryTier(moves) },
      { label: "Most recent eviction", description: "The latest book bumped out of S or A when capacity forced a choice.", result: mostRecentEviction(moves) },
      { label: "Highest score in Holding", description: "The best-scored book that still hasn't been judged onto the board.", result: highestScoredInHolding(books) },
    ],
    [books, moves, today]
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <RecordCard key={r.label} label={r.label} description={r.description} current={r.result} />
      ))}
    </div>
  );
}
