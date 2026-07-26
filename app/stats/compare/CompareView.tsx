"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "@/app/shared/fonts";
import { computeScoreHistogram } from "../distributionMath";
import type { BookSummary, DailyRow, FormatDailyRow, Goal, TbrEntry } from "../types";
import { AuthorsSection } from "./AuthorsSection";
import type { CompareScope } from "./compareScopeMath";
import { raceSeriesFor, resolveCompareScope } from "./compareScopeMath";
import { computeHeadline } from "./compareVerdicts";
import { CompareShareCard } from "./CompareShareCard";
import { FormatSection } from "./FormatSection";
import { GenreEraSection } from "./GenreEraSection";
import { PaceCompareSection } from "./PaceCompareSection";
import { RaceChart } from "./RaceChart";
import { ScopePicker } from "./ScopePicker";
import { TasteSection } from "./TasteSection";
import { VolumeSection } from "./VolumeSection";

export function CompareView({
  dailyRows,
  formatDailyRows,
  books,
  goals,
  tbrEntries,
  today,
  currentYear,
  years,
}: {
  dailyRows: DailyRow[];
  formatDailyRows: FormatDailyRow[];
  books: BookSummary[];
  goals: Goal[];
  tbrEntries: TbrEntry[];
  today: string;
  currentYear: number;
  years: number[];
}) {
  const [leftScope, setLeftScope] = useState<CompareScope>({ kind: "year", year: currentYear });
  const [rightScope, setRightScope] = useState<CompareScope>({ kind: "year", year: currentYear - 1 });

  const left = useMemo(
    () => resolveCompareScope(leftScope, { dailyRows, formatDailyRows, books, goals, today, currentYear }),
    [leftScope, dailyRows, formatDailyRows, books, goals, today, currentYear]
  );
  const right = useMemo(
    () => resolveCompareScope(rightScope, { dailyRows, formatDailyRows, books, goals, today, currentYear }),
    [rightScope, dailyRows, formatDailyRows, books, goals, today, currentYear]
  );

  const leftSeries = useMemo(() => raceSeriesFor(left, dailyRows, today, currentYear), [left, dailyRows, today, currentYear]);
  const rightSeries = useMemo(() => raceSeriesFor(right, dailyRows, today, currentYear), [right, dailyRows, today, currentYear]);
  const domainMaxX = Math.max(...leftSeries.map((p) => p.x), ...rightSeries.map((p) => p.x), 1);
  const domainMaxY = Math.max(...leftSeries.map((p) => p.y), ...rightSeries.map((p) => p.y), 1) * 1.05;

  const leftAvgScore = useMemo(() => computeScoreHistogram(left.books).mean, [left.books]);
  const rightAvgScore = useMemo(() => computeScoreHistogram(right.books).mean, [right.books]);

  const headline = computeHeadline({
    leftLabel: left.label,
    rightLabel: right.label,
    leftBooks: left.scopeData?.booksFinished ?? left.projected?.books ?? null,
    rightBooks: right.scopeData?.booksFinished ?? right.projected?.books ?? null,
    leftPages: left.scopeData?.totalPages ?? left.projected?.pages ?? null,
    rightPages: right.scopeData?.totalPages ?? right.projected?.pages ?? null,
    leftAvgScore,
    rightAvgScore,
  });

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-sm">
          <Link href="/stats" className="text-ink-warm-faint hover:text-ink-warm hover:underline">
            ← Back to stats
          </Link>
        </div>

        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Compare a Year</h1>
          <p className="mt-1 text-sm text-ink-warm-faint">A head-to-head lens over the same reading data -- no new numbers, just a different angle.</p>
        </header>

        <div className="mb-6 rounded-xl border border-gold bg-surface-1 p-4 text-center">
          <p className={`${fraunces.className} text-lg text-ink-warm sm:text-xl`}>{headline}</p>
        </div>

        <ScopePicker left={leftScope} right={rightScope} onLeftChange={setLeftScope} onRightChange={setRightScope} years={years} currentYear={currentYear} />

        <div className="mb-8 rounded-xl border border-gold bg-surface-1 p-4">
          <RaceChart
            domainMaxX={domainMaxX}
            domainMaxY={domainMaxY}
            left={{ label: left.label, points: leftSeries, colorClass: "text-accent-blue", dotClass: "bg-accent-blue" }}
            right={{ label: right.label, points: rightSeries, colorClass: "text-accent-coral", dotClass: "bg-accent-coral" }}
            startLabel="Jan 1"
            endLabel="Dec 31"
          />
        </div>

        <VolumeSection left={left} right={right} dailyRows={dailyRows} formatDailyRows={formatDailyRows} tbrEntries={tbrEntries} />
        <PaceCompareSection left={left} right={right} dailyRows={dailyRows} />
        <TasteSection left={left} right={right} />
        <GenreEraSection left={left} right={right} />
        <FormatSection left={left} right={right} />
        <AuthorsSection left={left} right={right} />

        <div className="mt-8 flex justify-center">
          <CompareShareCard
            data={{
              leftLabel: left.label,
              rightLabel: right.label,
              headline,
              leftLine: { label: left.label, points: leftSeries, colorClass: "text-accent-blue", dotClass: "bg-accent-blue" },
              rightLine: { label: right.label, points: rightSeries, colorClass: "text-accent-coral", dotClass: "bg-accent-coral" },
              domainMaxX,
              domainMaxY,
              leftBooks: left.scopeData?.booksFinished ?? left.projected?.books ?? null,
              rightBooks: right.scopeData?.booksFinished ?? right.projected?.books ?? null,
              leftPages: left.scopeData?.totalPages ?? left.projected?.pages ?? null,
              rightPages: right.scopeData?.totalPages ?? right.projected?.pages ?? null,
              leftAvgScore,
              rightAvgScore,
            }}
          />
        </div>

        <p className="mt-8 text-xs text-ink-warm-faint">
          Score comparisons across years can be affected by the end-of-year adjustment window --{" "}
          <Link href="/rankings" className="underline decoration-dotted underline-offset-4 hover:text-ink-warm">
            see adjustment history
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
