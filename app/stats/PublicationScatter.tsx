import Link from "next/link";
import { useRef, useState } from "react";
import { ChartTooltip } from "./ChartTooltip";
import { CoverThumb } from "./DistributionShared";
import { PUBLICATION_YEAR_FLOOR, jitterFor } from "./scatterMath";
import type { PublicationScatterPoint } from "./scatterMath";

type Hover = { point: PublicationScatterPoint; x: number; y: number };

// Same hand-rolled SVG house style as PaceHeroChart/ProjectionChart, with
// one deliberate difference: no preserveAspectRatio="none" here. That trick
// stretches x/y independently to fill the container, which is fine for a
// line (a stretched line is still a line) but turns circles into ellipses
// the moment the container's actual pixel aspect ratio drifts from the
// viewBox's. Instead the container is locked to the viewBox's own aspect
// ratio (aspect-[2/1]) via Tailwind, so the default uniform scaling keeps
// dots genuinely round.
export function PublicationScatter({
  points,
  domainMaxX,
  maxYear,
  startLabel,
  endLabel,
  yGridlines,
  xGridlines,
}: {
  points: PublicationScatterPoint[];
  domainMaxX: number;
  maxYear: number;
  startLabel: string;
  endLabel: string;
  yGridlines: number[];
  xGridlines: { x: number; label: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const width = 600;
  const height = 300;
  const padding = { top: 12, right: 8, bottom: 22, left: 30 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const safeMaxX = domainMaxX > 0 ? domainMaxX : 1;
  const yRange = Math.max(1, maxYear - PUBLICATION_YEAR_FLOOR);

  function scaleX(x: number) {
    return padding.left + (x / safeMaxX) * innerW;
  }
  function scaleY(y: number) {
    return padding.top + innerH - ((y - PUBLICATION_YEAR_FLOOR) / yRange) * innerH;
  }

  const JITTER_PX = 3;

  function handleEnter(e: React.MouseEvent, point: PublicationScatterPoint) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ point, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[2/1] w-full text-hairline">
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
              {y === PUBLICATION_YEAR_FLOOR ? `${y}-` : y}
            </text>
          </g>
        ))}

        {xGridlines.map((g) => (
          <g key={g.label}>
            <line
              x1={scaleX(g.x)}
              y1={padding.top}
              x2={scaleX(g.x)}
              y2={padding.top + innerH}
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.5}
            />
            <text x={scaleX(g.x)} y={padding.top + innerH + 12} textAnchor="middle" className="fill-ink-faint" style={{ fontSize: 9 }}>
              {g.label}
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

        {points.map((p) => {
          const jitter = jitterFor(p.bookId);
          const cx = scaleX(p.x) + jitter.dx * JITTER_PX;
          const cy = scaleY(p.yClamped) + jitter.dy * JITTER_PX;
          const isHovered = hover?.point.bookId === p.bookId;
          return (
            <Link key={p.bookId} href={`/books/${p.bookId}`}>
              <circle
                cx={cx}
                cy={cy}
                r={3.5}
                className="text-accent transition-opacity"
                fill={p.pinned ? "none" : "currentColor"}
                stroke={p.pinned ? "currentColor" : "none"}
                strokeWidth={p.pinned ? 1.5 : 0}
                opacity={isHovered ? 1 : 0.55}
                onMouseEnter={(e) => handleEnter(e, p)}
                onMouseLeave={() => setHover((h) => (h?.point.bookId === p.bookId ? null : h))}
              />
            </Link>
          );
        })}

        <text x={padding.left} y={height - 4} textAnchor="start" className="fill-ink-faint" style={{ fontSize: 10 }}>
          {startLabel}
        </text>
        <text x={width - padding.right} y={height - 4} textAnchor="end" className="fill-ink-faint" style={{ fontSize: 10 }}>
          {endLabel}
        </text>
      </svg>

      {hover && (
        <ChartTooltip x={hover.x} y={hover.y}>
          <div className="flex items-center gap-2">
            <CoverThumb title={hover.point.title} coverUrl={hover.point.coverUrl} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{hover.point.title}</p>
              {hover.point.author && <p className="truncate text-ink-faint">{hover.point.author}</p>}
              <p className="text-ink-faint">Published {hover.point.yTrue}</p>
            </div>
          </div>
        </ChartTooltip>
      )}
    </div>
  );
}
