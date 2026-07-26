"use client";

import Link from "next/link";
import { Fragment } from "react";
import { computeWeekdayFingerprint } from "@/app/home/weekdayFingerprintMath";
import type { WeekdayFingerprint } from "@/app/home/weekdayFingerprintMath";
import { computeBookPaceLeaderboard } from "../leaderboardMath";
import type { DailyRow } from "../types";
import { CompareSection, PairTile } from "./CompareSection";
import { computePaceVerdict } from "./compareVerdicts";
import type { CompareScopeData } from "./compareScopeMath";

function paceRates(data: CompareScopeData): { pagesPerDay: number; wordsPerDay: number } | null {
  if (data.scopeData) return { pagesPerDay: data.scopeData.pagesPerDay, wordsPerDay: data.scopeData.wordsPerDay };
  if (data.projected) return { pagesPerDay: data.projected.pagesPerDay, wordsPerDay: data.projected.wordsPerDay };
  return null;
}

// Small side-by-side bar sets -- WeekdayFingerprintChart.tsx is built
// around toggling one year at a time, not showing two simultaneously, so
// this is a light presentational reuse of the same WeekdayFingerprint math
// rather than that chart component.
function WeekdayBars({ fingerprint, accent }: { fingerprint: WeekdayFingerprint; accent: string }) {
  const maxAvg = Math.max(...fingerprint.bars.map((b) => b.avgPages), 1);
  return (
    <div>
      <div className="flex items-end gap-1">
        {fingerprint.bars.map((b) => (
          <div key={b.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end overflow-hidden rounded bg-hairline">
              <div
                className={`w-full rounded ${accent} ${b.isBest ? "opacity-100" : "opacity-50"}`}
                style={{ height: `${Math.max((b.avgPages / maxAvg) * 100, b.avgPages > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="text-[9px] text-ink-warm-faint">{b.shortDay[0]}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-warm-faint">{fingerprint.diagnosis}</p>
    </div>
  );
}

export function PaceCompareSection({
  left,
  right,
  dailyRows,
}: {
  left: CompareScopeData;
  right: CompareScopeData;
  dailyRows: DailyRow[];
}) {
  const leftRates = paceRates(left);
  const rightRates = paceRates(right);

  if (!leftRates || !rightRates) {
    return <CompareSection title="Pace" notTracked={`Not tracked for ${!leftRates ? left.label : right.label}.`} />;
  }

  const leftPaceBoard = computeBookPaceLeaderboard(left.books, "all");
  const rightPaceBoard = computeBookPaceLeaderboard(right.books, "all");

  const leftFingerprint = left.scope.kind === "year" ? computeWeekdayFingerprint(dailyRows, left.scope.year) : null;
  const rightFingerprint = right.scope.kind === "year" ? computeWeekdayFingerprint(dailyRows, right.scope.year) : null;

  const verdict = computePaceVerdict({
    leftLabel: left.label,
    rightLabel: right.label,
    leftPagesPerDay: leftRates.pagesPerDay,
    rightPagesPerDay: rightRates.pagesPerDay,
    leftBestWeekday: leftFingerprint?.bars.find((b) => b.isBest)?.day ?? null,
    rightBestWeekday: rightFingerprint?.bars.find((b) => b.isBest)?.day ?? null,
  });

  return (
    <CompareSection title="Pace" verdict={verdict}>
      <div className="grid grid-cols-2 gap-3">
        <PairTile label="Pages/day" leftValue={leftRates.pagesPerDay.toFixed(1)} rightValue={rightRates.pagesPerDay.toFixed(1)} />
        <PairTile label="Words/day" leftValue={Math.round(leftRates.wordsPerDay).toLocaleString()} rightValue={Math.round(rightRates.wordsPerDay).toLocaleString()} />
      </div>

      {(leftPaceBoard.length > 0 || rightPaceBoard.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {(
            [
              { label: "Fastest read", left: leftPaceBoard[0], right: rightPaceBoard[0] },
              {
                label: "Slowest read",
                left: leftPaceBoard[leftPaceBoard.length - 1],
                right: rightPaceBoard[rightPaceBoard.length - 1],
              },
            ] as const
          ).map((row) => (
            <Fragment key={row.label}>
              <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
                <p className="mb-1 uppercase tracking-wide text-ink-warm-faint">{row.label}</p>
                {row.left ? (
                  <>
                    {row.left.bookId ? (
                      <Link href={`/books/${row.left.bookId}`} className="text-ink-warm hover:underline">
                        {row.left.name}
                      </Link>
                    ) : (
                      <span className="text-ink-warm">{row.left.name}</span>
                    )}
                    <p className="text-ink-warm-faint">{row.left.primaryLabel}</p>
                  </>
                ) : (
                  <p className="text-ink-warm-faint">--</p>
                )}
              </div>
              <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
                <p className="mb-1 uppercase tracking-wide text-ink-warm-faint">{row.label}</p>
                {row.right ? (
                  <>
                    {row.right.bookId ? (
                      <Link href={`/books/${row.right.bookId}`} className="text-ink-warm hover:underline">
                        {row.right.name}
                      </Link>
                    ) : (
                      <span className="text-ink-warm">{row.right.name}</span>
                    )}
                    <p className="text-ink-warm-faint">{row.right.primaryLabel}</p>
                  </>
                ) : (
                  <p className="text-ink-warm-faint">--</p>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {leftFingerprint && rightFingerprint ? (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <WeekdayBars fingerprint={leftFingerprint} accent="bg-accent-blue" />
          <WeekdayBars fingerprint={rightFingerprint} accent="bg-accent-coral" />
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-ink-warm-faint">
          Weekday fingerprint isn&apos;t tracked for {!leftFingerprint ? left.label : right.label}.
        </p>
      )}
    </CompareSection>
  );
}
