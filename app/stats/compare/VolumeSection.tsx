"use client";

import { RecordCard } from "../RecordCard";
import type { RecordContext } from "../recordsMath";
import { peakDay, goldenMonth } from "../recordsMath";
import type { DailyRow, FormatDailyRow, TbrEntry } from "../types";
import { CompareSection, PairTile } from "./CompareSection";
import { computeVolumeVerdict } from "./compareVerdicts";
import type { CompareScopeData } from "./compareScopeMath";

// Either side's headline volume numbers -- real totals for a year/all-time
// scope, extrapolated totals for a projection (no day-level records apply
// to a hypothetical year, so those stay null).
function volumeNumbers(data: CompareScopeData): { books: number; pages: number; words: number } | null {
  if (data.scopeData) return { books: data.scopeData.booksFinished, pages: data.scopeData.totalPages, words: Math.round(data.scopeData.totalWordsEstimate) };
  if (data.projected) return { books: data.projected.books, pages: data.projected.pages, words: data.projected.words };
  return null;
}

function recordContextFor(data: CompareScopeData, dailyRows: DailyRow[], formatDailyRows: FormatDailyRow[], tbrEntries: TbrEntry[]): RecordContext | null {
  if (!data.scopeData) return null; // no day-level history for a projection
  const { start, end } = data.scopeData;
  return {
    books: data.books,
    dailyRows: dailyRows.filter((r) => r.date >= start && r.date <= end),
    formatDailyRows: formatDailyRows.filter((r) => r.date >= start && r.date <= end),
    tbrEntries,
    birthdayMMDD: null,
    year: data.scope.kind === "year" ? data.scope.year : null,
    start,
    end,
  };
}

export function VolumeSection({
  left,
  right,
  dailyRows,
  formatDailyRows,
  tbrEntries,
}: {
  left: CompareScopeData;
  right: CompareScopeData;
  dailyRows: DailyRow[];
  formatDailyRows: FormatDailyRow[];
  tbrEntries: TbrEntry[];
}) {
  const leftNums = volumeNumbers(left);
  const rightNums = volumeNumbers(right);

  if (!leftNums || !rightNums) {
    return <CompareSection title="Volume" notTracked={`Not tracked for ${!leftNums ? left.label : right.label}.`} />;
  }

  const verdict = computeVolumeVerdict({
    leftLabel: left.label,
    rightLabel: right.label,
    leftBooks: leftNums.books,
    rightBooks: rightNums.books,
    leftPages: leftNums.pages,
    rightPages: rightNums.pages,
    leftWords: leftNums.words,
    rightWords: rightNums.words,
  });

  const leftCtx = recordContextFor(left, dailyRows, formatDailyRows, tbrEntries);
  const rightCtx = recordContextFor(right, dailyRows, formatDailyRows, tbrEntries);

  return (
    <CompareSection title="Volume" verdict={verdict}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <PairTile label="Books" leftValue={String(leftNums.books)} rightValue={String(rightNums.books)} />
        <PairTile label="Pages" leftValue={leftNums.pages.toLocaleString()} rightValue={rightNums.pages.toLocaleString()} />
        <PairTile label="Words" leftValue={leftNums.words.toLocaleString()} rightValue={rightNums.words.toLocaleString()} />
        {left.scopeData && right.scopeData && (
          <>
            <PairTile label="Reading days" leftValue={String(left.scopeData.readingDays)} rightValue={String(right.scopeData.readingDays)} />
            <PairTile label="Longest streak" leftValue={`${left.scopeData.bestStreak}d`} rightValue={`${right.scopeData.bestStreak}d`} />
          </>
        )}
      </div>

      {leftCtx && rightCtx && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <RecordCard label="Best single day" current={peakDay(leftCtx)} />
          <RecordCard label="Best single day" current={peakDay(rightCtx)} />
          <RecordCard label="Biggest month" current={goldenMonth(leftCtx)} />
          <RecordCard label="Biggest month" current={goldenMonth(rightCtx)} />
        </div>
      )}
    </CompareSection>
  );
}
