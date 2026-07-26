"use client";

import Link from "next/link";
import { useMemo } from "react";
import { fraunces } from "@/app/shared/fonts";
import { SectionShell } from "@/app/stats/SectionShell";
import { computeBoardAtGlance } from "./boardAtGlanceMath";
import { BoardAtGlanceSection } from "./BoardAtGlanceSection";
import { ScoreVsTierSection } from "./ScoreVsTierSection";
import { TierByDimensionSection } from "./TierByDimensionSection";
import { SizeShapeSection } from "./SizeShapeSection";
import { MovementSection } from "./MovementSection";
import { SuperlativesSection } from "./SuperlativesSection";
import type { Capacities } from "../types";
import type { SeriesParent, TierMoveFull, TierStatBook } from "./types";

export function TierStatsView({
  books,
  moves,
  capacities,
  totalFinished,
  seriesParents,
  today,
}: {
  books: TierStatBook[];
  moves: TierMoveFull[];
  capacities: Capacities;
  totalFinished: number;
  seriesParents: SeriesParent[];
  today: string;
}) {
  const glance = useMemo(() => computeBoardAtGlance(books, capacities, totalFinished), [books, capacities, totalFinished]);

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 text-sm">
          <Link href="/rankings/tiers" className="text-ink-warm-faint hover:text-ink-warm hover:underline">
            ← Back to tier board
          </Link>
        </div>

        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Tier Stats</h1>
          <p className="mt-1 text-sm text-ink-warm-faint">
            What does the tier board say about your taste, compared to what your scores already said?
          </p>
        </header>

        <SectionShell title="The board at a glance">
          <BoardAtGlanceSection data={glance} />
        </SectionShell>

        <SectionShell title="Score vs tier">
          <ScoreVsTierSection books={books} />
        </SectionShell>

        <SectionShell title="Tier by dimension">
          <TierByDimensionSection books={books} seriesParents={seriesParents} />
        </SectionShell>

        <SectionShell title="Size and shape">
          <SizeShapeSection books={books} />
        </SectionShell>

        <SectionShell title="Movement">
          <MovementSection moves={moves} books={books} today={today} />
        </SectionShell>

        <SectionShell title="Superlatives">
          <SuperlativesSection books={books} moves={moves} today={today} />
        </SectionShell>
      </div>
    </div>
  );
}
