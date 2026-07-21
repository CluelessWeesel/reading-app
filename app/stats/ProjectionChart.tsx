import { useRef, useState } from "react";
import { formatPagesK } from "./statsMath";

type Point = { x: number; y: number };
type YearSeries = { year: number; points: Point[]; isCurrent: boolean };

// Same hand-rolled SVG technique as PaceHeroChart.tsx (fixed viewBox,
// preserveAspectRatio="none", manual M/L path strings) -- see that file's
// comment for why no charting library is used here.
export function ProjectionChart({
  series,
  domainMaxX,
  domainMaxY,
}: {
  series: YearSeries[];
  domainMaxX: number;
  domainMaxY: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const width = 600;
  const height = 240;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const safeMaxX = domainMaxX > 0 ? domainMaxX : 1;
  const safeMaxY = domainMaxY > 0 ? domainMaxY : 1;

  function scaleX(x: number) {
    return padding.left + (x / safeMaxX) * innerW;
  }
  function scaleY(y: number) {
    return padding.top + innerH - (y / safeMaxY) * innerH;
  }
  function pathFor(points: Point[]) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(" ");
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const x = Math.round(((svgX - padding.left) / innerW) * safeMaxX);
    setHoverX(Math.max(0, Math.min(domainMaxX, x)));
  }

  // Only show a year if hoverX actually falls within its drawn range (the
  // current year's line stops at today, not day 365).
  const hoverEntries =
    hoverX == null
      ? []
      : series
          .filter((s) => s.points.length > 0 && hoverX <= s.points[s.points.length - 1].x)
          .map((s) => ({ year: s.year, value: (s.points.find((p) => p.x === hoverX) ?? s.points[s.points.length - 1]).y }));

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-48 w-full text-hairline sm:h-64"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverX(null)}
      >
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={width - padding.right}
          y2={padding.top + innerH}
          stroke="currentColor"
          strokeWidth={1}
        />

        {series
          .filter((s) => !s.isCurrent)
          .map((s) => (
            <path
              key={s.year}
              d={pathFor(s.points)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="text-ink-warm-faint opacity-40"
            />
          ))}

        {series
          .filter((s) => s.isCurrent)
          .map((s) => (
            <path key={s.year} d={pathFor(s.points)} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-accent" />
          ))}

        {hoverX != null && (
          <line
            x1={scaleX(hoverX)}
            y1={padding.top}
            x2={scaleX(hoverX)}
            y2={padding.top + innerH}
            stroke="currentColor"
            strokeWidth={1}
            className="text-ink-warm-faint opacity-50"
          />
        )}
      </svg>

      <p className="mt-1 text-xs text-ink-warm-faint">
        {hoverEntries.length > 0
          ? hoverEntries
              .sort((a, b) => b.year - a.year)
              .map((e) => `${e.year}: ${formatPagesK(e.value)}`)
              .join(" · ")
          : "Hover the chart to compare years at the same point in the year."}
      </p>
    </div>
  );
}
