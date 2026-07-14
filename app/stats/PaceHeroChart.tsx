type Point = { x: number; y: number };

// A hand-rolled responsive line chart -- no charting library in the project,
// and this is simple enough (up to three straight/polyline paths over a
// shared linear scale) not to need one. preserveAspectRatio="none" lets the
// SVG stretch to whatever width/height its container gives it, which is
// exactly what a responsive line chart wants (the axes aren't meant to stay
// visually 1:1).
export function PaceHeroChart({
  domainMaxX,
  domainMaxY,
  actualPoints,
  goalPoints,
  projectionPoints,
  overlaySeries,
  startLabel,
  endLabel,
}: {
  domainMaxX: number;
  domainMaxY: number;
  actualPoints: Point[];
  goalPoints?: Point[] | null;
  projectionPoints?: Point[] | null;
  overlaySeries?: { year: number; points: Point[] }[];
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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-48 w-full text-hairline sm:h-64"
    >
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={width - padding.right}
        y2={padding.top + innerH}
        stroke="currentColor"
        strokeWidth={1}
      />

      {overlaySeries?.map((s) => (
        <path
          key={s.year}
          d={pathFor(s.points)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="text-ink-faint opacity-40"
        />
      ))}

      {goalPoints && (
        <path
          d={pathFor(goalPoints)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          className="text-ink-faint"
        />
      )}
      {projectionPoints && (
        <path
          d={pathFor(projectionPoints)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray="1 5"
          strokeLinecap="round"
          className="text-accent"
        />
      )}
      <path d={pathFor(actualPoints)} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-accent" />

      <text x={padding.left} y={height - 4} textAnchor="start" className="fill-ink-faint" style={{ fontSize: 10 }}>
        {startLabel}
      </text>
      <text
        x={width - padding.right}
        y={height - 4}
        textAnchor="end"
        className="fill-ink-faint"
        style={{ fontSize: 10 }}
      >
        {endLabel}
      </text>
    </svg>
  );
}
