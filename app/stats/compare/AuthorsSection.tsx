"use client";

import Link from "next/link";
import { buildAuthorIdMap, computeFlatLeaderboards } from "../leaderboardMath";
import type { LeaderboardEntry } from "../leaderboardMath";
import { CompareSection } from "./CompareSection";
import { computeAuthorsCrossover } from "./compareVerdicts";
import type { CompareScopeData } from "./compareScopeMath";

function TopAuthorsList({ label, entries, idMap }: { label: string; entries: LeaderboardEntry[]; idMap: Map<string, number> }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-warm-faint">No authors with pages in scope.</p>
      ) : (
        <ol className="space-y-1.5">
          {entries.slice(0, 3).map((e, i) => (
            <li key={e.name} className="flex items-baseline gap-2 text-sm">
              <span className="text-ink-warm-faint">{i + 1}.</span>
              {idMap.has(e.name) ? (
                <Link href={`/authors/${idMap.get(e.name)}`} className="truncate text-ink-warm hover:underline">
                  {e.name}
                </Link>
              ) : (
                <span className="truncate text-ink-warm">{e.name}</span>
              )}
              <span className="ml-auto shrink-0 text-xs text-ink-warm-faint">{e.primaryLabel}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AuthorsSection({ left, right }: { left: CompareScopeData; right: CompareScopeData }) {
  if (left.books.length === 0 || right.books.length === 0) {
    return <CompareSection title="Authors" notTracked={`Not tracked for ${left.books.length === 0 ? left.label : right.label} -- no real books in scope.`} />;
  }

  const leftBoard = computeFlatLeaderboards(left.books, (b) => b.author, 1).pages;
  const rightBoard = computeFlatLeaderboards(right.books, (b) => b.author, 1).pages;
  const leftIdMap = buildAuthorIdMap(left.books);
  const rightIdMap = buildAuthorIdMap(right.books);

  const verdict = computeAuthorsCrossover(leftBoard, rightBoard, left.label, right.label);

  return (
    <CompareSection title="Authors" verdict={verdict}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TopAuthorsList label={`${left.label} — top by pages`} entries={leftBoard} idMap={leftIdMap} />
        <TopAuthorsList label={`${right.label} — top by pages`} entries={rightBoard} idMap={rightIdMap} />
      </div>
    </CompareSection>
  );
}
