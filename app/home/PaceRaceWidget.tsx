import { PaceHeroChart } from "../stats/PaceHeroChart";
import { daysBetweenInclusive } from "../shared/isoDate";
import { WidgetShell } from "./WidgetShell";

// All four years' cumulative pages on one chart, current year highlighted
// (via PaceHeroChart's actualPoints) and past years muted (its
// overlaySeries) -- the same overlay the /stats Pace section can toggle on,
// just always-on here since comparing years against each other is this
// widget's whole point.
export function PaceRaceWidget({
  currentYear,
  currentYearSeries,
  priorYearSeries,
}: {
  currentYear: number;
  currentYearSeries: { date: string; pages: number; cumulative: number }[];
  priorYearSeries: { year: number; points: { x: number; y: number }[] }[];
}) {
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  const domainMaxX = daysBetweenInclusive(yearStart, yearEnd) - 1;
  const actualPoints = currentYearSeries.map((s, i) => ({ x: i, y: s.cumulative }));
  const dayIndex = currentYearSeries.length - 1;
  const currentCum = currentYearSeries[currentYearSeries.length - 1]?.cumulative ?? 0;

  const aheadYears = priorYearSeries
    .map((s) => ({ year: s.year, cum: s.points[Math.min(dayIndex, s.points.length - 1)]?.y ?? 0 }))
    .filter((s) => s.cum > currentCum)
    .sort((a, b) => b.cum - a.cum);

  const domainMaxY =
    Math.max(currentCum, ...priorYearSeries.flatMap((s) => s.points.map((p) => p.y)), 1) * 1.05;

  const verdict =
    priorYearSeries.length === 0
      ? null
      : aheadYears.length === 0
        ? `Leading every previous year at day ${dayIndex + 1}.`
        : `Behind ${aheadYears.map((y) => y.year).join(", ")} at day ${dayIndex + 1}.`;

  return (
    <WidgetShell title="The pace race" href="/stats" hrefLabel="Full stats">
      <PaceHeroChart
        domainMaxX={domainMaxX}
        domainMaxY={domainMaxY}
        actualPoints={actualPoints}
        overlaySeries={priorYearSeries}
        startLabel={yearStart}
        endLabel={yearEnd}
      />
      {verdict && <p className="mt-2 text-xs text-ink-faint">{verdict}</p>}
    </WidgetShell>
  );
}
