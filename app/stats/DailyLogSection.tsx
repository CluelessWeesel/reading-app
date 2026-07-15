"use client";

import { computeDailyLog, type DailyLogRow } from "./dailyLogMath";
import { divergingColor } from "./divergingColor";
import { fraunces } from "../shared/fonts";
import type { DailyRow, Scope } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

function columnRange(rows: DailyLogRow[], pick: (r: DailyLogRow) => number): { min: number; max: number } {
  const values = rows.map(pick);
  return { min: Math.min(...values), max: Math.max(...values) };
}

// `cap` clamps the top of the scale (e.g. pages-in-a-day) so one outlier
// day doesn't stretch the range and wash out color differences between
// every normal day -- anything at or above the cap reads as fully green.
function heat(value: number, range: { min: number; max: number }, cap?: number): { background: string; color: string } {
  const effectiveMax = cap != null ? Math.min(range.max, cap) : range.max;
  const clamped = cap != null ? Math.min(value, cap) : value;
  const percentile = effectiveMax > range.min ? (clamped - range.min) / (effectiveMax - range.min) : 1;
  return divergingColor(percentile);
}

function Cell({
  value,
  decimals = 0,
  colored,
}: {
  value: number;
  decimals?: number;
  colored?: { background: string; color: string };
}) {
  return (
    <td
      className="whitespace-nowrap px-3 py-1.5 text-right text-sm tabular-nums"
      style={colored ? { backgroundColor: colored.background, color: colored.color } : undefined}
    >
      {value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </td>
  );
}

export function DailyLogSection({
  dailyRows,
  today,
  currentYear,
  scope,
}: {
  dailyRows: DailyRow[];
  today: string;
  currentYear: number;
  scope: Scope;
}) {
  if (scope.kind === "all") {
    return (
      <p className="py-12 text-center text-sm text-ink-faint">
        Pick a year above to see its daily log.
      </p>
    );
  }

  const rows = computeDailyLog(dailyRows, scope.year, today, currentYear);
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-faint">No reading logged for {scope.year} yet.</p>;
  }

  const pagesRange = columnRange(rows, (r) => r.pagesToday);
  const projectedRange = columnRange(rows, (r) => r.projected);
  const averageRange = columnRange(rows, (r) => r.yearlyAverage);

  const reversed = [...rows].reverse();

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <h3 className={`${fraunces.className} mb-3 text-base font-semibold text-ink`}>Daily log -- {scope.year}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-hairline text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2 text-left">Day</th>
              <th className="px-3 py-2 text-right">Total pages (year)</th>
              <th className="px-3 py-2 text-right">Pages that day</th>
              <th className="px-3 py-2 text-right">Projected pages</th>
              <th className="px-3 py-2 text-right">Daily projection</th>
              <th className="px-3 py-2 text-right">Yearly average</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/60">
            {reversed.map((r) => (
              <tr key={r.date}>
                <td className="whitespace-nowrap px-3 py-1.5 text-sm text-ink">{formatDayLabel(r.date)}</td>
                <Cell value={r.cumulative} />
                <Cell value={r.pagesToday} colored={heat(r.pagesToday, pagesRange, 200)} />
                <Cell value={Math.round(r.projected)} colored={heat(r.projected, projectedRange)} />
                <Cell value={Math.round(r.dailyProjection)} />
                <Cell value={r.yearlyAverage} decimals={1} colored={heat(r.yearlyAverage, averageRange)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
