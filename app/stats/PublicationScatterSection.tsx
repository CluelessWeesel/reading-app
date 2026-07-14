"use client";

import { useMemo } from "react";
import { PublicationScatter } from "./PublicationScatter";
import { computePublicationScatterPoints, computeXGridlines, computeYGridlines } from "./scatterMath";
import { SectionShell } from "./SectionShell";
import type { BookSummary, Scope } from "./types";

function excludedNoteFor(excluded: number, reason: string): string | null {
  return excluded > 0 ? `${excluded} book${excluded === 1 ? "" : "s"} excluded (${reason})` : null;
}

export function PublicationScatterSection({
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
  // Same "only actually-finished books count" rule every other section uses
  // (Leaderboards, Distributions, Records).
  const scopedBooks = useMemo(
    () => books.filter((b) => b.date_finished != null && (scope.kind === "all" || b.year_read === scope.year)),
    [books, scope]
  );
  const data = useMemo(
    () => computePublicationScatterPoints(scopedBooks, scope, today, currentYear),
    [scopedBooks, scope, today, currentYear]
  );
  const yGridlines = useMemo(() => computeYGridlines(data.maxYear), [data.maxYear]);
  const xGridlines = useMemo(
    () => computeXGridlines(scope, data.start, data.end),
    [scope, data.start, data.end]
  );

  return (
    <SectionShell title="Publication years">
      <div className="rounded-xl border border-hairline bg-card/40 p-4">
        {excludedNoteFor(data.excluded, "no publication year") && (
          <p className="mb-2 text-xs text-ink-faint">{excludedNoteFor(data.excluded, "no publication year")}</p>
        )}
        {data.points.length < 2 ? (
          <p className="py-8 text-center text-sm text-ink-faint">Not enough books in scope yet.</p>
        ) : (
          <PublicationScatter
            points={data.points}
            domainMaxX={data.domainMaxX}
            maxYear={data.maxYear}
            startLabel={data.start}
            endLabel={data.end}
            yGridlines={yGridlines}
            xGridlines={xGridlines}
          />
        )}
      </div>
    </SectionShell>
  );
}
