"use client";

import { useMemo } from "react";
import { PagesPerDayLineChart } from "./PagesPerDayLineChart";
import { computeNiceGridlines, computePagesPerDaySeries } from "./scatterMath";
import { SectionShell } from "./SectionShell";
import type { BookSummary, Scope } from "./types";

function excludedNoteFor(excluded: number, reason: string): string | null {
  return excluded > 0 ? `${excluded} book${excluded === 1 ? "" : "s"} excluded (${reason})` : null;
}

export function PagesPerDaySection({ books, scope }: { books: BookSummary[]; scope: Scope }) {
  // Same "only actually-finished books count" rule every other section uses.
  const scopedBooks = useMemo(
    () => books.filter((b) => b.date_finished != null && (scope.kind === "all" || b.year_read === scope.year)),
    [books, scope]
  );
  const data = useMemo(() => computePagesPerDaySeries(scopedBooks), [scopedBooks]);
  // Shared Y-scale across both charts so their heights are directly comparable.
  const yGridlines = useMemo(() => computeNiceGridlines(data.maxValue), [data.maxValue]);

  return (
    <SectionShell title="Avg pages/day per book">
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        {excludedNoteFor(data.excluded, "no tracked pace") && (
          <p className="mb-3 text-xs text-ink-warm-faint">{excludedNoteFor(data.excluded, "no tracked pace")}</p>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">
              Physical · {data.physical.length} books
            </p>
            <PagesPerDayLineChart points={data.physical} maxValue={data.maxValue} yGridlines={yGridlines} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">
              Audio · {data.audio.length} books
            </p>
            <PagesPerDayLineChart points={data.audio} maxValue={data.maxValue} yGridlines={yGridlines} />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
