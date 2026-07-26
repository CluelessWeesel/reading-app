"use client";

import { DistributionCard } from "../DistributionCard";
import { computeScoreHistogram } from "../distributionMath";
import { CompareSection, PairTile } from "./CompareSection";
import { computeTasteVerdict, stddev } from "./compareVerdicts";
import type { CompareScopeData } from "./compareScopeMath";

function captionFor(hist: ReturnType<typeof computeScoreHistogram>): string {
  return `Mean ${hist.mean?.toFixed(2) ?? "--"} · Median ${hist.median?.toFixed(2) ?? "--"} · Mode ${hist.mode?.toFixed(1) ?? "--"}`;
}

export function TasteSection({ left, right }: { left: CompareScopeData; right: CompareScopeData }) {
  if (left.books.length === 0 || right.books.length === 0) {
    return <CompareSection title="Taste" notTracked={`Not tracked for ${left.books.length === 0 ? left.label : right.label} -- no real books in scope.`} />;
  }

  const leftHist = computeScoreHistogram(left.books);
  const rightHist = computeScoreHistogram(right.books);
  const leftStddev = stddev(left.books.filter((b) => b.score != null).map((b) => b.score as number));
  const rightStddev = stddev(right.books.filter((b) => b.score != null).map((b) => b.score as number));
  const leftFives = leftHist.buckets.find((b) => b.key === "5")?.count ?? 0;
  const rightFives = rightHist.buckets.find((b) => b.key === "5")?.count ?? 0;

  const verdict = computeTasteVerdict({
    leftLabel: left.label,
    rightLabel: right.label,
    leftMean: leftHist.mean,
    rightMean: rightHist.mean,
    leftStddev,
    rightStddev,
  });

  return (
    <CompareSection title="Taste" verdict={verdict}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DistributionCard
          title={left.label}
          buckets={leftHist.buckets}
          orientation="vertical"
          valueOf={(b) => b.count}
          formatValue={(v) => `${v} book${v === 1 ? "" : "s"}`}
          caption={captionFor(leftHist)}
        />
        <DistributionCard
          title={right.label}
          buckets={rightHist.buckets}
          orientation="vertical"
          valueOf={(b) => b.count}
          formatValue={(v) => `${v} book${v === 1 ? "" : "s"}`}
          caption={captionFor(rightHist)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <PairTile label="5.0 scores" leftValue={String(leftFives)} rightValue={String(rightFives)} />
        <PairTile
          label="Rating spread (σ)"
          leftValue={leftStddev != null ? leftStddev.toFixed(2) : "--"}
          rightValue={rightStddev != null ? rightStddev.toFixed(2) : "--"}
        />
      </div>
    </CompareSection>
  );
}
