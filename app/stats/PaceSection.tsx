"use client";

import { useState } from "react";
import { fraunces } from "../shared/fonts";
import { daysBetweenInclusive } from "../shared/isoDate";
import { PaceHeroChart } from "./PaceHeroChart";
import { SectionShell } from "./SectionShell";
import { formatPagesK } from "./statsMath";
import type { ScopeData } from "./types";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
      <p className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>{value}</p>
      {sub && <p className="text-xs text-ink-warm-faint">{sub}</p>}
    </div>
  );
}

export function PaceSection({
  data,
  isCurrentYear,
  priorYearSeries,
  onSaveGoal,
}: {
  data: ScopeData;
  isCurrentYear: boolean;
  priorYearSeries: { year: number; points: { x: number; y: number }[] }[];
  onSaveGoal: (year: number, pagesGoal: number) => Promise<void>;
}) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(data.goal ?? ""));
  const [saving, setSaving] = useState(false);
  const [showPriorYears, setShowPriorYears] = useState(false);

  const scope = data.scope;
  const isYear = scope.kind === "year";
  const year = isYear ? scope.year : null;
  const overlayActive = isCurrentYear && showPriorYears && priorYearSeries.length > 0;

  // The chart's x-domain stretches to Dec 31 whenever there's a goal,
  // projection, or the prior-years overlay to draw across the rest of the
  // year -- otherwise it just spans the actual data collected so far.
  const domainEnd = isYear && (data.goal != null || overlayActive) ? `${year}-12-31` : data.end;
  const domainMaxX = daysBetweenInclusive(data.start, domainEnd) - 1;

  const actualPoints = data.series.map((s, i) => ({ x: i, y: s.cumulative }));

  const goalPoints =
    isYear && data.goal != null ? [{ x: 0, y: 0 }, { x: domainMaxX, y: data.goal }] : null;

  const projectionPoints = data.projection
    ? [
        { x: data.series.length - 1, y: data.totalPages },
        { x: domainMaxX, y: data.projection.projectedTotal },
      ]
    : null;

  const overlayMaxY = overlayActive
    ? Math.max(0, ...priorYearSeries.flatMap((s) => s.points.map((p) => p.y)))
    : 0;
  const domainMaxY =
    Math.max(data.totalPages, data.goal ?? 0, data.projection?.projectedTotal ?? 0, overlayMaxY, 1) * 1.05;

  function headline(): string {
    if (scope.kind === "all") return `${formatPagesK(data.totalPages)} pages total`;
    if (data.projection) {
      return `Projected ${formatPagesK(data.projection.projectedTotal)} vs ${formatPagesK(data.goal as number)} goal · ${data.projection.verdict}`;
    }
    if (data.pastYearVerdict) {
      return `${formatPagesK(data.pastYearVerdict.finalTotal)} vs ${formatPagesK(data.goal as number)} goal · ${data.pastYearVerdict.verdict}`;
    }
    return `${formatPagesK(data.totalPages)} pages${isCurrentYear ? " so far" : ""}`;
  }

  async function handleSaveGoal() {
    if (year == null) return;
    const n = Number(goalInput);
    if (!Number.isFinite(n) || n <= 0) return;
    setSaving(true);
    try {
      await onSaveGoal(year, Math.round(n));
      setEditingGoal(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionShell title="Pace">
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <p className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>{headline()}</p>

        {isYear && (
          <div className="mt-1 text-xs">
            {editingGoal ? (
              <span className="inline-flex items-center gap-2">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-24 rounded border border-gold bg-surface-1 px-1.5 py-0.5 text-xs text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  disabled={saving}
                  className="text-accent underline decoration-dotted underline-offset-4 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGoal(false)}
                  className="text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setGoalInput(String(data.goal ?? ""));
                  setEditingGoal(true);
                }}
                className="text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                {data.goal != null ? `Goal: ${data.goal.toLocaleString()} pages · Edit` : "Set a goal for this year"}
              </button>
            )}
          </div>
        )}

        <div className="mt-3">
          {isCurrentYear && priorYearSeries.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPriorYears((v) => !v)}
                aria-pressed={showPriorYears}
                className={`rounded-full border border-gold px-3 py-1 text-xs transition ${
                  showPriorYears ? "bg-hover text-ink-warm" : "text-ink-warm-faint hover:text-ink-warm"
                }`}
              >
                {showPriorYears ? "Hide" : "Compare to"} previous years
              </button>
              {overlayActive && (
                <p className="text-xs text-ink-warm-faint">{priorYearSeries.map((s) => s.year).join(", ")}</p>
              )}
            </div>
          )}
          <PaceHeroChart
            domainMaxX={domainMaxX}
            domainMaxY={domainMaxY}
            actualPoints={actualPoints}
            goalPoints={goalPoints}
            projectionPoints={projectionPoints}
            overlaySeries={overlayActive ? priorYearSeries : undefined}
            startLabel={data.start}
            endLabel={domainEnd}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Total pages" value={formatPagesK(data.totalPages)} />
          <StatCard label="Total words" value={formatPagesK(data.totalWordsEstimate)} />
          <StatCard label="Books finished" value={String(data.booksFinished)} />
          <StatCard label="Avg. pages/book" value={data.avgBookLength != null ? `${Math.round(data.avgBookLength)} pg` : "--"} />
          <StatCard
            label="Book-equivalents"
            value={(data.totalWordsEstimate / 90_000).toFixed(1)}
            sub="90k words/book"
          />
          <StatCard label="Pages/day" value={data.pagesPerDay.toFixed(1)} />
          <StatCard label="Words/day" value={formatPagesK(data.wordsPerDay)} />
          <StatCard label="Reading days" value={`${data.readingDays} / ${data.totalDays}`} />
          {data.currentStreak != null && <StatCard label="Current streak" value={`${data.currentStreak}d`} />}
          <StatCard label="Best streak" value={`${data.bestStreak}d`} />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Format</h3>
          {data.formatSplit.hasSplitData ? (
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Physical"
                value={data.formatSplit.physical ? `${data.formatSplit.physical.avgPages.toFixed(0)} pg/day` : "--"}
                sub={data.formatSplit.physical ? `${data.formatSplit.physical.days} days` : undefined}
              />
              <StatCard
                label="Audio"
                value={data.formatSplit.audio ? `${data.formatSplit.audio.avgPages.toFixed(0)} pg/day` : "--"}
                sub={data.formatSplit.audio ? `${data.formatSplit.audio.days} days` : undefined}
              />
            </div>
          ) : (
            <div>
              <StatCard label="Daily average" value={`${data.pagesPerDay.toFixed(1)} pg/day`} />
              <p className="mt-1.5 text-xs text-ink-warm-faint">Per-format tracking begins mid-2026.</p>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
