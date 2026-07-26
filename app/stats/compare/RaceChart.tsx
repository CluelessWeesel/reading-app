type Point = { x: number; y: number };
export type RaceLine = { label: string; points: Point[]; colorClass: string; dotClass: string };

// Sibling to PaceHeroChart.tsx, same house style (viewBox, scaleX/scaleY/
// pathFor, currentColor tokens) -- but PaceHeroChart hard-codes exactly one
// bold "actual" line plus faint gray overlays all rendered identically, so
// it can't give two combatants equal visual weight. This gives both lines
// the same stroke width and their own distinct color, with a small legend
// instead of relying on a single implicit "the bold one."
export function RaceChart({
  domainMaxX,
  domainMaxY,
  left,
  right,
  startLabel,
  endLabel,
}: {
  domainMaxX: number;
  domainMaxY: number;
  left: RaceLine;
  right: RaceLine;
  startLabel: string;
  endLabel: string;
}) {
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

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-48 w-full text-hairline sm:h-64">
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={width - padding.right}
          y2={padding.top + innerH}
          stroke="currentColor"
          strokeWidth={1}
        />

        <path d={pathFor(left.points)} fill="none" stroke="currentColor" strokeWidth={2.5} className={left.colorClass} />
        <path d={pathFor(right.points)} fill="none" stroke="currentColor" strokeWidth={2.5} className={right.colorClass} />

        <text x={padding.left} y={height - 4} textAnchor="start" className="fill-ink-faint" style={{ fontSize: 10 }}>
          {startLabel}
        </text>
        <text x={width - padding.right} y={height - 4} textAnchor="end" className="fill-ink-faint" style={{ fontSize: 10 }}>
          {endLabel}
        </text>
      </svg>

      <div className="mt-2 flex items-center justify-center gap-5 text-xs text-ink-warm-faint">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${left.dotClass}`} />
          {left.label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${right.dotClass}`} />
          {right.label}
        </span>
      </div>
    </div>
  );
}
