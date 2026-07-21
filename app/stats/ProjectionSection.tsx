"use client";

import { useMemo } from "react";
import { fraunces } from "../shared/fonts";
import { ProjectionChart } from "./ProjectionChart";
import { SectionShell } from "./SectionShell";
import { computeProjectionSeries, formatPagesK } from "./statsMath";
import type { DailyRow, Scope } from "./types";

export function ProjectionSection({
  dailyRows,
  years,
  currentYear,
  today,
  scope,
}: {
  dailyRows: DailyRow[];
  years: number[];
  currentYear: number;
  today: string;
  scope: Scope;
}) {
  const series = useMemo(
    () => computeProjectionSeries(dailyRows, years, currentYear, today, scope),
    [dailyRows, years, currentYear, today, scope]
  );

  const focal = scope.kind === "year" ? series.find((s) => s.year === scope.year) : series.find((s) => s.isCurrent);
  const focalLast = focal?.points[focal.points.length - 1];

  const headline =
    focal && focalLast
      ? focal.year === currentYear
        ? `Projected ${formatPagesK(focalLast.y)} pages this year`
        : `${focal.year}: ${formatPagesK(focalLast.y)} pages, final`
      : "Not enough data yet.";

  const domainMaxX = 364;
  const domainMaxY = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y))) * 1.05;

  return (
    <SectionShell title="Projection">
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <p className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>{headline}</p>
        <div className="mt-3">
          {series.every((s) => s.points.length === 0) ? (
            <p className="py-8 text-center text-sm text-ink-warm-faint">Not enough books in scope yet.</p>
          ) : (
            <ProjectionChart series={series} domainMaxX={domainMaxX} domainMaxY={domainMaxY} />
          )}
        </div>
      </div>
    </SectionShell>
  );
}
