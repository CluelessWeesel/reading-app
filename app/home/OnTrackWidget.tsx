import { PaceHeroChart } from "../stats/PaceHeroChart";
import { formatPagesK } from "../stats/statsMath";
import { daysBetweenInclusive } from "../shared/isoDate";
import { fraunces } from "../shared/fonts";
import { WidgetShell } from "./WidgetShell";
import type { ScopeData } from "../stats/types";

// A compact single-year version of the /stats Pace hero -- same underlying
// ScopeData and chart component, just without the format-split cards,
// prior-years overlay, or goal-editing controls that live on the full page.
export function OnTrackWidget({ data, currentYear }: { data: ScopeData; currentYear: number }) {
  const domainEnd = data.goal != null ? `${currentYear}-12-31` : data.end;
  const domainMaxX = daysBetweenInclusive(data.start, domainEnd) - 1;
  const actualPoints = data.series.map((s, i) => ({ x: i, y: s.cumulative }));
  const goalPoints = data.goal != null ? [{ x: 0, y: 0 }, { x: domainMaxX, y: data.goal }] : null;
  const projectionPoints = data.projection
    ? [
        { x: data.series.length - 1, y: data.totalPages },
        { x: domainMaxX, y: data.projection.projectedTotal },
      ]
    : null;
  const domainMaxY = Math.max(data.totalPages, data.goal ?? 0, data.projection?.projectedTotal ?? 0, 1) * 1.05;

  function headline(): string {
    if (data.projection) {
      return `Projected ${formatPagesK(data.projection.projectedTotal)} vs ${formatPagesK(
        data.goal as number
      )} — ${data.projection.verdict}`;
    }
    return `${formatPagesK(data.totalPages)} pages so far this year`;
  }

  return (
    <WidgetShell title="On track" href="/stats" hrefLabel="Full stats">
      <p className={`${fraunces.className} text-lg font-semibold text-ink`}>{headline()}</p>
      <div className="mt-3">
        <PaceHeroChart
          domainMaxX={domainMaxX}
          domainMaxY={domainMaxY}
          actualPoints={actualPoints}
          goalPoints={goalPoints}
          projectionPoints={projectionPoints}
          startLabel={data.start}
          endLabel={domainEnd}
        />
      </div>
    </WidgetShell>
  );
}
