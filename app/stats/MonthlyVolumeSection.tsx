"use client";

import { useMemo, useState } from "react";
import { pillClass } from "./DistributionShared";
import { computeMonthlyBuckets } from "./distributionMath";
import type { Bucket } from "./distributionMath";
import { MonthlyVolumeChart } from "./MonthlyVolumeChart";
import { SectionShell } from "./SectionShell";
import type { BookSummary, Scope } from "./types";

function excludedNoteFor(excluded: number, reason: string): string | null {
  return excluded > 0 ? `${excluded} book${excluded === 1 ? "" : "s"} excluded (${reason})` : null;
}

type Mode = "books" | "pages";

export function MonthlyVolumeSection({
  books,
  scope,
  today,
  currentYear,
}: {
  books: BookSummary[];
  scope: Scope;
  today: string;
  currentYear: number;
}) {
  const [mode, setMode] = useState<Mode>("books");

  // Same "only actually-finished books count" rule every other section uses.
  const scopedBooks = useMemo(
    () => books.filter((b) => b.date_finished != null && (scope.kind === "all" || b.year_read === scope.year)),
    [books, scope]
  );
  const data = useMemo(
    () => computeMonthlyBuckets(scopedBooks, scope, today, currentYear),
    [scopedBooks, scope, today, currentYear]
  );

  const valueOf = (b: Bucket) => (mode === "books" ? b.count : b.pages);
  const formatValue = (v: number) => (mode === "books" ? `${v} book${v === 1 ? "" : "s"}` : `${Math.round(v).toLocaleString()} pages`);

  return (
    <SectionShell title="Monthly volume">
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => setMode("books")} aria-pressed={mode === "books"} className={pillClass(mode === "books")}>
            Books finished
          </button>
          <button type="button" onClick={() => setMode("pages")} aria-pressed={mode === "pages"} className={pillClass(mode === "pages")}>
            Pages read
          </button>
        </div>

        {excludedNoteFor(data.excluded, "no finish date") && (
          <p className="mb-2 text-xs text-ink-warm-faint">{excludedNoteFor(data.excluded, "no finish date")}</p>
        )}

        {data.buckets.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-warm-faint">Not enough books in scope yet.</p>
        ) : (
          <MonthlyVolumeChart buckets={data.buckets} valueOf={valueOf} formatValue={formatValue} />
        )}
      </div>
    </SectionShell>
  );
}
