"use client";

import { useState } from "react";
import type { ScoreArcPoint } from "./derivedStats";

// My scores for their books, in reading order -- a simple connected-dot
// line, not a bar chart, since the point is the shape of the trend.
export function ScoreArc({ points }: { points: ScoreArcPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 400;
  const height = 120;
  const paddingX = 16;
  const paddingY = 6;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;
  const maxX = points.length - 1;

  function x(i: number): number {
    return paddingX + (maxX > 0 ? (i / maxX) * innerW : innerW / 2);
  }
  function y(score: number): number {
    return paddingY + innerH - (score / 5) * innerH;
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const hovered = hoveredIndex != null ? points[hoveredIndex] : null;

  return (
    <div>
      <div className="flex items-stretch gap-1">
        <div className="relative h-28 w-3 shrink-0">
          {[5, 4, 3, 2, 1, 0].map((score) => (
            <span
              key={score}
              className="absolute left-0 -translate-y-1/2 text-[9px] leading-none text-ink-warm-faint"
              style={{ top: `${(y(score) / height) * 100}%` }}
            >
              {score}
            </span>
          ))}
        </div>

        <div className="relative h-28 flex-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full text-hairline"
          >
            {[0, 1, 2, 3, 4, 5].map((score) => (
              <line
                key={score}
                x1={paddingX}
                y1={y(score)}
                x2={width - paddingX}
                y2={y(score)}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={score === 0 ? undefined : "3 3"}
                opacity={score === 0 ? 1 : 0.4}
              />
            ))}

            <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-accent" />

            {points.map((p, i) => (
              <g key={p.book_id}>
                <circle
                  cx={x(i)}
                  cy={y(p.score)}
                  r={8}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex((idx) => (idx === i ? null : idx))}
                />
                <circle
                  cx={x(i)}
                  cy={y(p.score)}
                  r={hoveredIndex === i ? 5 : 3}
                  className="pointer-events-none fill-accent transition-[r]"
                />
              </g>
            ))}
          </svg>
        </div>
      </div>

      <p className="mt-1.5 h-4 truncate text-xs text-ink-warm-faint">
        {hovered ? (
          <>
            <span className="text-ink-warm">{hovered.title}</span>: {hovered.score.toFixed(1)}
          </>
        ) : (
          "Hover a point for details"
        )}
      </p>
    </div>
  );
}
