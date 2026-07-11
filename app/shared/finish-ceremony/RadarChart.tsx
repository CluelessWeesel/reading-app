"use client";

export function RadarChart({
  categories,
}: {
  categories: { category: string; score: number | null }[];
}) {
  const size = 240;
  const labelMargin = 44;
  const viewSize = size + labelMargin * 2;
  const center = viewSize / 2;
  const maxRadius = size / 2 - 46;
  const n = categories.length;
  if (n < 3) return null;

  function pointFor(index: number, ratio: number) {
    const angle = (index / n) * 2 * Math.PI - Math.PI / 2;
    const r = maxRadius * ratio;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  }

  const dataPoints = categories.map((c, i) => pointFor(i, (c.score ?? 0) / 5));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${viewSize} ${viewSize}`} className="mx-auto w-full max-w-[280px] text-hairline">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={Array.from({ length: n }, (_, i) => pointFor(i, ratio))
            .map((p) => `${p.x},${p.y}`)
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
        />
      ))}
      {categories.map((_, i) => {
        const p = pointFor(i, 1);
        return (
          <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth={1} />
        );
      })}
      <polygon points={polygonPoints} className="fill-accent/20 stroke-accent" strokeWidth={2} />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-accent" />
      ))}
      {categories.map((c, i) => {
        const p = pointFor(i, 1.24);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-ink-faint"
            style={{ fontSize: 9 }}
          >
            {c.category}
          </text>
        );
      })}
    </svg>
  );
}
