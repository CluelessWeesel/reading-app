"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "@/app/shared/fonts";
import { InfoTooltip } from "@/app/shared/InfoTooltip";
import { CoverThumb, EmptyState } from "@/app/stats/DistributionShared";
import { computeAgreement, computeDisagreements } from "../scoreVsTierMath";
import type { Disagreement } from "../scoreVsTierMath";
import { tierLabel } from "../tierColors";
import { computeScoreTierGrid } from "./scoreGridMath";
import { ScoreTierGrid } from "./ScoreTierGrid";
import type { TierStatBook } from "./types";

const PAGE_SIZE = 8;

function DisagreementList({ title, tone, entries }: { title: string; tone: "up" | "down"; entries: Disagreement[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, PAGE_SIZE);
  const toneClass = tone === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <div>
      <p className={`mb-1.5 text-xs font-medium uppercase tracking-wide ${toneClass}`}>{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-warm-faint">None right now.</p>
      ) : (
        <>
          <div className="divide-y divide-gold">
            {shown.map((d) => (
              <div key={d.book_id} className="flex items-center gap-2.5 py-1.5">
                <CoverThumb title={d.title} coverUrl={d.cover_url} />
                <Link href={`/books/${d.book_id}`} className="min-w-0 flex-1 truncate text-sm text-ink-warm hover:underline">
                  {d.title}
                </Link>
                <span className="shrink-0 text-xs text-ink-warm-faint">
                  {d.score.toFixed(2)} · {tierLabel(d.tier)}
                </span>
                <span className={`shrink-0 text-xs font-medium ${toneClass}`}>
                  {Math.round(Math.abs(d.disagreement) * 100)}%
                </span>
              </div>
            ))}
          </div>
          {entries.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
            >
              {expanded ? "Show fewer" : `Show all ${entries.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ScoreVsTierSection({ books }: { books: TierStatBook[] }) {
  const disagreements = useMemo(() => {
    // Holding has no tier judgment to compare a score against -- including
    // it would always read as maximal "disagreement" regardless of the
    // score, which isn't a real disagreement, just an unjudged book.
    const rows = books
      .filter((b): b is TierStatBook & { score: number } => b.score != null && b.tier !== "holding")
      .map((b) => ({ book_id: b.book_id, title: b.title, cover_url: b.cover_url, score: b.score, tier: b.tier }));
    return computeDisagreements(rows);
  }, [books]);

  const agreement = useMemo(() => computeAgreement(disagreements), [disagreements]);
  const grid = useMemo(() => computeScoreTierGrid(books), [books]);

  if (disagreements.length < 5) {
    return (
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <EmptyState message="Not enough scored, placed books yet — this fills in as more books get both a score and a tier." />
      </div>
    );
  }

  const underrated = disagreements.filter((d) => d.disagreement > 0);
  const overrated = disagreements.filter((d) => d.disagreement < 0);

  return (
    <div className="space-y-4">
      {agreement != null && (
        <div className="relative rounded-xl border border-gold bg-surface-1 p-4 text-center">
          <div className="absolute right-3 top-3">
            <InfoTooltip text="For every scored book that's been judged onto a tier (Holding excluded -- it has no tier to compare against): how close its score's percentile (rank among all scored books, 1 = best) is to its tier's normalized rank (S = 1, F = 0). Averaged and inverted into a percentage -- 100% would mean tier and score always land in exactly the same spot." />
          </div>
          <p className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>{Math.round(agreement)}%</p>
          <p className="mt-1 text-sm text-ink-warm-faint">of the time, your tiers agree with your scores.</p>
        </div>
      )}

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Where they disagree most</h3>
          <InfoTooltip text="Underrated by tier = the score thinks more of the book than its tier does (a high score sitting in a low tier). Overrated by tier = the tier thinks more of it than the score does (a modest score sitting in a high tier). The % is the gap between the book's score percentile and its tier's normalized rank." />
        </div>
        <p className="mb-3 text-xs text-ink-warm-faint">Gap between the score&apos;s percentile and the tier&apos;s rank, quantified.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DisagreementList title="Underrated by tier" tone="up" entries={underrated} />
          <DisagreementList title="Overrated by tier" tone="down" entries={overrated} />
        </div>
      </div>

      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Score vs tier, all books</h3>
          <InfoTooltip text="Every scored, placed book, bucketed by tier (column) and score (row). A cell's color shows how closely tier and score agree for the books in it -- green near the diagonal (they agree), red far from it. Click a cell to see which books are in it." />
        </div>
        <ScoreTierGrid data={grid} />
      </div>
    </div>
  );
}
