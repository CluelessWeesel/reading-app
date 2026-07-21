"use client";

import { useState } from "react";
import type { WeekdayFingerprint } from "../weekdayFingerprintMath";

// The year toggle + per-bar hover state are the only interactive parts of
// this widget, isolated to this leaf so WeekdayFingerprintWidget itself can
// stay a plain server component (see GenreDietWidget/GenreDietBar for why
// that split matters for the widget's static .size property).
export function WeekdayFingerprintChart({
  fingerprintByYear,
  years,
  defaultYear,
}: {
  fingerprintByYear: Record<number, WeekdayFingerprint | null>;
  years: number[];
  defaultYear: number;
}) {
  const [year, setYear] = useState(defaultYear);
  const [hovered, setHovered] = useState<string | null>(null);

  const fingerprint = fingerprintByYear[year];
  const maxAvg = fingerprint ? Math.max(...fingerprint.bars.map((b) => b.avgPages), 1) : 1;
  const active = fingerprint?.bars.find((b) => b.day === hovered) ?? null;

  return (
    <>
      <div className="mb-2 flex gap-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => {
              setYear(y);
              setHovered(null);
            }}
            disabled={!fingerprintByYear[y]}
            aria-pressed={year === y}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
              year === y ? "bg-accent-blue text-on-accent" : "text-ink-warm-faint hover:text-ink-warm"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {fingerprint ? (
        <>
          <div className="flex h-16 items-end gap-1.5" onMouseLeave={() => setHovered(null)}>
            {fingerprint.bars.map((bar) => (
              <div key={bar.day} className="relative flex flex-1 flex-col items-center gap-1">
                <div className="flex h-12 w-full items-end">
                  <div
                    onMouseEnter={() => setHovered(bar.day)}
                    className="w-full cursor-default rounded-t-sm"
                    style={{
                      height: `${Math.max(4, (bar.avgPages / maxAvg) * 100)}%`,
                      backgroundColor: bar.isBest ? "var(--accent-blue)" : "var(--accent-blue-chip)",
                      opacity: bar.isBest ? 1 : bar.isNearZero ? 0.5 : 1,
                    }}
                  />
                </div>
                <span className={`text-[10px] ${bar.isBest ? "font-bold text-ink-warm" : "text-ink-warm-faint"}`}>
                  {bar.shortDay}
                </span>

                {hovered === bar.day && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max -translate-x-1/2 rounded-lg border border-gold bg-surface-1 px-2.5 py-1.5 text-xs shadow-lg">
                    <p className="font-semibold text-ink-warm">{Math.round(bar.totalPages).toLocaleString()} pages total</p>
                    <p className="text-ink-warm-faint">{bar.avgPages.toFixed(1)} avg/day</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-ink-warm-faint">
            {active ? `${active.day}: ${Math.round(active.totalPages).toLocaleString()} pages total` : fingerprint.diagnosis}
          </p>
        </>
      ) : (
        <p className="text-xs text-ink-warm-faint">Not enough data for {year} yet.</p>
      )}
    </>
  );
}
