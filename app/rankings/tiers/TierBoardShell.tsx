"use client";

import { useRouter } from "next/navigation";
import { fraunces } from "../../shared/fonts";
import { TierBoard } from "./TierBoard";
import { FillFlow } from "./FillFlow";
import { MovementPanel } from "./MovementPanel";
import { ScoreVsTierPanel } from "./ScoreVsTierPanel";
import type { Disagreement } from "./scoreVsTierMath";
import type { Capacities, QueueBook, TierBoardData, TierMove } from "./types";

export function TierBoardShell({
  initialBoard,
  capacities,
  fillCompleted,
  initialQueue,
  recentMoves,
  reclassifications,
  disagreements,
}: {
  initialBoard: TierBoardData;
  capacities: Capacities;
  fillCompleted: boolean;
  initialQueue: QueueBook[];
  recentMoves: TierMove[];
  reclassifications: TierMove[];
  disagreements: Disagreement[];
}) {
  const router = useRouter();

  if (!fillCompleted) {
    return (
      <FillFlow
        initialQueue={initialQueue}
        initialBoard={initialBoard}
        capacities={capacities}
        onDone={() => router.refresh()}
      />
    );
  }

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Tier Board</h1>
          <p className="mt-1 text-sm text-ink-warm-faint">
            A score answers &ldquo;how good was it?&rdquo; A tier answers &ldquo;what does it mean to me now?&rdquo;
          </p>
        </header>

        <TierBoard initialBoard={initialBoard} capacities={capacities} />

        <div className="mt-10 space-y-6">
          <MovementPanel recentMoves={recentMoves} reclassifications={reclassifications} />
          <ScoreVsTierPanel disagreements={disagreements} />
        </div>
      </div>
    </div>
  );
}
