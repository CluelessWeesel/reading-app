"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "../shared/fonts";
import { RankingsView } from "./RankingsView";
import { SeriesRankingsView } from "./SeriesRankingsView";
import { SERIES_LIST_NAMES } from "./types";
import type { HonourItem } from "../shared/HonourBadge";
import type { AdjustmentWindowData, SeriesRankedRow, StatusFlag, YearData } from "./types";

type Tab = "books" | "series";

const TABS: { key: Tab; label: string }[] = [
  { key: "books", label: "Books" },
  { key: "series", label: "Series" },
];

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
      <p className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>{value}</p>
      {sub && <p className="text-xs text-ink-warm-faint">{sub}</p>}
    </div>
  );
}

// Stats are computed from the master "Series Manually Ranked (1+ Books)"
// list only, not summed across all three -- Main/Sub are alternate curated
// re-groupings of an overlapping subset of the same series (a series can
// appear in both), so combining their counts would double-count.
function countByStatus(rows: SeriesRankedRow[]): Record<StatusFlag, number> {
  const counts: Record<StatusFlag, number> = { Complete: 0, "Not Complete": 0, Unpublished: 0 };
  for (const r of rows) counts[r.status_flag]++;
  return counts;
}

export function RankingsShell({
  bookData,
  years,
  defaultYear,
  bookHonours,
  sealedYears,
  seriesData,
  mainSeriesData,
  subSeriesData,
  adjustmentWindow,
  holdingCount,
}: {
  bookData: Record<number, YearData>;
  years: number[];
  defaultYear: number;
  bookHonours: Record<number, HonourItem[]>;
  sealedYears: number[];
  seriesData: SeriesRankedRow[];
  mainSeriesData: SeriesRankedRow[];
  subSeriesData: SeriesRankedRow[];
  adjustmentWindow: AdjustmentWindowData;
  holdingCount: number;
}) {
  const [tab, setTab] = useState<Tab>("books");

  const statusCounts = useMemo(() => countByStatus(seriesData), [seriesData]);
  const total = seriesData.length;
  const percentComplete = total > 0 ? Math.round((statusCounts.Complete / total) * 100) : 0;

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className={`mx-auto ${tab === "series" ? "max-w-6xl" : "max-w-3xl"}`}>
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Rankings</h1>
        </header>

        <div className="mb-6 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.key
                    ? "bg-accent text-on-accent"
                    : "border border-gold bg-surface-1 text-ink-warm-muted hover:bg-hover"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Link
            href="/rankings/tiers"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold bg-surface-1 px-4 py-1.5 text-sm font-medium text-ink-warm-muted transition hover:bg-hover"
          >
            Tier Board
            {holdingCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">
                {holdingCount}
              </span>
            )}
          </Link>
        </div>

        {tab === "books" && (
          <RankingsView
            data={bookData}
            years={years}
            defaultYear={defaultYear}
            bookHonours={bookHonours}
            sealedYears={sealedYears}
            adjustmentWindow={adjustmentWindow}
          />
        )}

        {tab === "series" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Complete" value={`${percentComplete}%`} sub={`${statusCounts.Complete} of ${total}`} />
              <StatTile label="Active" value={String(statusCounts["Not Complete"])} sub="Not complete" />
              <StatTile label="Unpublished" value={String(statusCounts.Unpublished)} />
              <StatTile label="Total series" value={String(total)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <h3 className={`${fraunces.className} mb-2 text-sm font-semibold text-ink-warm`}>Series</h3>
                <SeriesRankingsView listName={SERIES_LIST_NAMES[0]} initialRows={seriesData} />
              </div>
              <div>
                <h3 className={`${fraunces.className} mb-2 text-sm font-semibold text-ink-warm`}>Main Series</h3>
                <SeriesRankingsView listName={SERIES_LIST_NAMES[1]} initialRows={mainSeriesData} />
              </div>
              <div>
                <h3 className={`${fraunces.className} mb-2 text-sm font-semibold text-ink-warm`}>Sub Series</h3>
                <SeriesRankingsView listName={SERIES_LIST_NAMES[2]} initialRows={subSeriesData} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
