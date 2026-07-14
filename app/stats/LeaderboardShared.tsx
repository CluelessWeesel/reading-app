"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { rankColor } from "@/app/books/[id]/rankColor";
import type { LeaderboardEntry } from "./leaderboardMath";

export function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition ${
    active ? "bg-accent text-on-accent" : "border border-hairline text-ink-muted hover:bg-hover"
  }`;
}

// Links to the author's page when its id is known (kept as its own
// component so the calling card just resolves a name -> id lookup and
// doesn't need to know how the link itself is rendered).
export function AuthorName({ name, authorId }: { name: string; authorId?: number | null }) {
  if (authorId == null) return <span className="truncate text-ink">{name}</span>;
  return (
    <Link href={`/authors/${authorId}`} className="truncate text-ink hover:underline">
      {name}
    </Link>
  );
}

const PAGE_SIZE = 10;

// Rank is coloured on the same green (best) to red (worst) gradient used
// for book rankings. Only the top 10 render by default -- "Show all" reveals
// the rest -- so a big "All time" scope doesn't dump a hundred rows at once.
export function RankedList({
  entries,
  renderName,
}: {
  entries: LeaderboardEntry[];
  renderName?: (entry: LeaderboardEntry) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-faint">No data for this metric in scope.</p>;
  }

  const shown = expanded ? entries : entries.slice(0, PAGE_SIZE);

  return (
    <div>
      <ul className="divide-y divide-hairline">
        {shown.map((e, i) => {
          const { background, color } = rankColor(i + 1, entries.length);
          return (
            <li key={e.bookId ?? `${e.name}-${i}`} className="flex items-start gap-3 py-2 text-sm">
              <span
                className="mt-0.5 flex w-7 shrink-0 items-center justify-center rounded-full py-0.5 text-xs font-medium"
                style={{ background, color }}
              >
                {i + 1}
              </span>
              {/* Name gets its own full-width line -- a long title next to a
                  long metric string ("76.8 pg/day · 5 days · Audiobook")
                  would otherwise squeeze the name down to nothing. */}
              <div className="min-w-0 flex-1">
                <div className="truncate">{renderName ? renderName(e) : e.name}</div>
                <div className="truncate text-xs">
                  <span className="text-ink">{e.primaryLabel}</span>{" "}
                  <span className="text-ink-faint">· {e.secondaryLabel}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {entries.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          {expanded ? "Show top 10" : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}
