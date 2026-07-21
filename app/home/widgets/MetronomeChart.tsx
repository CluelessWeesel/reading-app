import type { MetronomePoint } from "../metronomeMath";

// Hand-rolled SVG, same house style as the stats page's own line charts:
// fixed viewBox, preserveAspectRatio="none" to stretch into its container,
// currentColor for both stroke and fill so accent + dark mode fall out of
// the wrapping element's text color for free.
const WIDTH = 600;
const HEIGHT = 180;
const PAD_TOP = 18;
const PAD_BOTTOM = 8;

export function MetronomeChart({
  points,
  cruise,
  current,
}: {
  points: MetronomePoint[];
  cruise: number;
  current: number;
}) {
  const values = points.map((p) => p.rollingAvg);
  const dataMax = Math.max(...values, cruise);
  const dataMin = Math.min(...values, cruise);
  const range = dataMax - dataMin || 1;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  function yFor(v: number): number {
    return PAD_TOP + plotHeight - ((v - dataMin) / range) * plotHeight;
  }
  function xFor(i: number): number {
    return points.length > 1 ? (i / (points.length - 1)) * WIDTH : 0;
  }

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.rollingAvg).toFixed(1)}`).join(" ");
  const cruiseY = yFor(cruise);
  const lastX = xFor(points.length - 1);
  const lastY = yFor(current);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-24 w-full text-accent-coral" aria-hidden>
      <line
        x1={0}
        y1={cruiseY}
        x2={WIDTH}
        y2={cruiseY}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="6 5"
        opacity={0.4}
      />
      <text x={4} y={Math.max(12, cruiseY - 5)} textAnchor="start" fill="currentColor" opacity={0.6} style={{ fontSize: 11, fontWeight: 600 }}>
        cruise {cruise.toFixed(1)}
      </text>
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4.5" fill="currentColor" />
      <text
        x={Math.max(0, lastX - 9)}
        y={Math.max(13, lastY - 9)}
        textAnchor="end"
        fill="currentColor"
        style={{ fontSize: 15, fontWeight: 700 }}
      >
        {current.toFixed(1)}
      </text>
    </svg>
  );
}
