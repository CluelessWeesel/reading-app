import Link from "next/link";
import { useRef, useState } from "react";
import { ChartTooltip } from "./ChartTooltip";
import { CoverThumb } from "./DistributionShared";
import type { PagesPerDayLinePoint } from "./scatterMath";

type Hover = { point: PagesPerDayLinePoint; x: number; y: number };

// One book per point, in reading order, connected by a zigzagging line --
// X is sequential position (not a date), Y is avg_pages_per_day. Same
// aspect-locked-container technique as PublicationScatter so point markers
// stay round, plus a floating tooltip board on hover/click-through to the
// book's dossier.
export function PagesPerDayLineChart({
  points,
  maxValue,
  yGridlines,
}: {
  points: PagesPerDayLinePoint[];
  maxValue: number;
  yGridlines: number[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const width = 600;
  const height = 240;
  const padding = { top: 12, right: 8, bottom: 8, left: 30 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const safeMaxX = Math.max(1, points.length - 1);
  const safeMaxY = maxValue > 0 ? maxValue : 1;

  function scaleX(x: number) {
    return padding.left + (x / safeMaxX) * innerW;
  }
  function scaleY(y: number) {
    return padding.top + innerH - (y / safeMaxY) * innerH;
  }
  function pathFor(pts: PagesPerDayLinePoint[]) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)},${scaleY(p.value).toFixed(1)}`).join(" ");
  }

  function handleEnter(e: React.MouseEvent, point: PagesPerDayLinePoint) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ point, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">Not enough books in scope yet.</p>;
  }

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[5/2] w-full text-hairline">
        {yGridlines.map((y) => (
          <g key={y}>
            <line
              x1={padding.left}
              y1={scaleY(y)}
              x2={width - padding.right}
              y2={scaleY(y)}
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.5}
            />
            <text x={padding.left - 4} y={scaleY(y) + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: 9 }}>
              {y}
            </text>
          </g>
        ))}

        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={width - padding.right}
          y2={padding.top + innerH}
          stroke="currentColor"
          strokeWidth={1}
        />

        <path d={pathFor(points)} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-accent" />

        {points.map((p) => {
          const isHovered = hover?.point.bookId === p.bookId;
          return (
            <Link key={p.bookId} href={`/books/${p.bookId}`}>
              <circle
                cx={scaleX(p.x)}
                cy={scaleY(p.value)}
                r={isHovered ? 4 : 2.5}
                className="text-accent transition-all"
                fill="currentColor"
                onMouseEnter={(e) => handleEnter(e, p)}
                onMouseLeave={() => setHover((h) => (h?.point.bookId === p.bookId ? null : h))}
              />
            </Link>
          );
        })}
      </svg>

      {hover && (
        <ChartTooltip x={hover.x} y={hover.y}>
          <div className="flex items-center gap-2">
            <CoverThumb title={hover.point.title} coverUrl={hover.point.coverUrl} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{hover.point.title}</p>
              {hover.point.author && <p className="truncate text-ink-faint">{hover.point.author}</p>}
              <p className="text-ink-faint">{hover.point.value.toFixed(1)} pg/day</p>
            </div>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
