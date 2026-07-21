"use client";

import { useMemo, useState } from "react";
import { CollapsibleCard, EmptyState } from "./DistributionShared";
import { computeFlatLeaderboards } from "./leaderboardMath";
import type { BookSummary } from "./types";

// Not a histogram -- a compact sorted dot-plot answering "which genres do I
// actually rate highest", reusing the same avgScore aggregation the
// Leaderboards section already computes per genre.
export function RatingByGenreCard({ books }: { books: BookSummary[] }) {
  const [minBooksOn, setMinBooksOn] = useState(true);

  const entries = useMemo(
    () => computeFlatLeaderboards(books, (b) => b.genre, minBooksOn ? 2 : 1).avgScore,
    [books, minBooksOn]
  );

  const toggle = (
    <button
      type="button"
      onClick={() => setMinBooksOn((v) => !v)}
      aria-pressed={minBooksOn}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        minBooksOn ? "border-accent bg-accent/10 text-ink-warm" : "border-gold text-ink-warm-faint hover:text-ink-warm"
      }`}
    >
      2+ books
    </button>
  );

  if (books.length < 3) {
    return (
      <CollapsibleCard title="Rating by genre" toggle={toggle}>
        <EmptyState message="Not enough books in scope yet." />
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard title="Rating by genre" toggle={toggle}>
      {entries.length === 0 ? (
        <EmptyState message="No genres meet the threshold yet." />
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.name} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-ink-warm">{e.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-hairline">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.min((e.sortValue / 5) * 100, 100)}%` }}
                />
              </span>
              <span className="w-28 shrink-0 whitespace-nowrap text-right text-ink-warm-faint">
                {e.primaryLabel} · {e.secondaryLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleCard>
  );
}
