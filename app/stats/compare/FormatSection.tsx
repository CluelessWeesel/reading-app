"use client";

import { WORDS_PER_HOUR } from "@/app/home/inYourEarsMath";
import { computeFormatSplit } from "../distributionMath";
import type { BookSummary } from "../types";
import { CompareSection, PairTile } from "./CompareSection";
import { computeFormatVerdict } from "./compareVerdicts";
import type { CompareScopeData } from "./compareScopeMath";

function audioPercent(books: BookSummary[]): number {
  if (books.length === 0) return 0;
  return (books.filter((b) => b.format_type === "audio").length / books.length) * 100;
}

// Same estimate In Your Ears already uses (150 words/min -- no per-book
// tracked runtime exists anywhere in the app), applied to this scope's
// audiobooks instead of the whole year.
function audioHours(books: BookSummary[]): number {
  const words = books
    .filter((b) => b.format_type === "audio" && b.word_count != null)
    .reduce((sum, b) => sum + (b.word_count as number), 0);
  return words / WORDS_PER_HOUR;
}

export function FormatSection({ left, right }: { left: CompareScopeData; right: CompareScopeData }) {
  if (left.books.length === 0 || right.books.length === 0) {
    return <CompareSection title="Format" notTracked={`Not tracked for ${left.books.length === 0 ? left.label : right.label} -- no real books in scope.`} />;
  }

  const leftSplit = computeFormatSplit(left.books);
  const rightSplit = computeFormatSplit(right.books);
  const leftAudioPct = audioPercent(left.books);
  const rightAudioPct = audioPercent(right.books);
  const leftHours = audioHours(left.books);
  const rightHours = audioHours(right.books);

  const verdict = computeFormatVerdict({ leftLabel: left.label, rightLabel: right.label, leftAudioPct, rightAudioPct });

  return (
    <CompareSection title="Format" verdict={verdict}>
      <div className="grid grid-cols-3 gap-3">
        {leftSplit.buckets.map((b, i) => (
          <PairTile
            key={b.key}
            label={b.label}
            leftValue={`${b.count} bk${b.count === 1 ? "" : "s"}`}
            rightValue={`${rightSplit.buckets[i]?.count ?? 0} bk${(rightSplit.buckets[i]?.count ?? 0) === 1 ? "" : "s"}`}
          />
        ))}
      </div>

      {(leftHours > 0 || rightHours > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PairTile label="Audio hours (est.)" leftValue={`${leftHours.toFixed(1)}h`} rightValue={`${rightHours.toFixed(1)}h`} />
        </div>
      )}
    </CompareSection>
  );
}
