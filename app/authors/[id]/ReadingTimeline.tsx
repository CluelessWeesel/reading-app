"use client";

import { useState } from "react";
import { daysBetweenInclusive } from "@/app/shared/isoDate";
import { formatDateShort } from "@/app/shared/formatDateShort";
import type { TimelinePoint } from "./derivedStats";

// Matches the hardcoded year range used elsewhere on the site (/stats,
// /rankings) so a timeline is comparable in absolute terms across authors.
const YEARS = [2023, 2024, 2025, 2026];

function xFraction(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4));
  const yearIndex = YEARS.indexOf(year);
  if (yearIndex === -1) return 0;
  const dayOfYear = daysBetweenInclusive(`${year}-01-01`, dateStr) - 1;
  const daysInYear = daysBetweenInclusive(`${year}-01-01`, `${year}-12-31`);
  return (yearIndex + dayOfYear / daysInYear) / YEARS.length;
}

export function ReadingTimeline({ points }: { points: TimelinePoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 400;
  const height = 60;
  const padding = 16;
  const innerW = width - padding * 2;
  const rowY = height / 2;
  const hovered = hoveredIndex != null ? points[hoveredIndex] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-14 w-full text-hairline">
        <line x1={padding} y1={rowY} x2={width - padding} y2={rowY} stroke="currentColor" strokeWidth={1} />
        {YEARS.map((y, i) => (
          <line
            key={y}
            x1={padding + (i / YEARS.length) * innerW}
            y1={padding / 2}
            x2={padding + (i / YEARS.length) * innerW}
            y2={height - padding / 2}
            stroke="currentColor"
            strokeWidth={1}
            className="opacity-40"
          />
        ))}
        {points.map((p, i) => {
          const cx = padding + xFraction(p.date_finished) * innerW;
          return (
            <g key={p.book_id}>
              <circle
                cx={cx}
                cy={rowY}
                r={8}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex((idx) => (idx === i ? null : idx))}
              />
              <circle
                cx={cx}
                cy={rowY}
                r={hoveredIndex === i ? 6 : 4}
                className="pointer-events-none fill-accent transition-[r]"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-faint">
        {YEARS.map((y) => (
          <span key={y}>{y}</span>
        ))}
      </div>
      <p className="mt-1 h-4 truncate text-xs text-ink-faint">
        {hovered ? (
          <>
            <span className="text-ink">{hovered.title}</span> — {formatDateShort(hovered.date_finished)}
          </>
        ) : (
          "Hover a point for details"
        )}
      </p>
    </div>
  );
}
