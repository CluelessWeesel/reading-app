type Bar = { date: string; pages: number };

// A hand-rolled filled line chart -- same fixed-viewBox/preserveAspectRatio
// technique as the stats page's PaceHeroChart, just for a daily pages
// series instead of a cumulative one. Used by both the recap's month-shape
// card and Wrapped's year-shape card, which differ only in point density
// (~30 vs ~365) and theme (parchment vs night) -- both already resolve
// through currentColor/CSS-variable tokens, so nothing else needs to change
// between the two callers.
export function DailyPagesGraph({ bars, bestDate }: { bars: Bar[]; bestDate: string | null }) {
  const width = 600;
  const height = 160;
  const padding = { top: 10, right: 4, bottom: 4, left: 4 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxPages = Math.max(...bars.map((b) => b.pages), 1);

  function scaleX(i: number): number {
    return padding.left + (bars.length <= 1 ? 0 : (i / (bars.length - 1)) * innerW);
  }
  function scaleY(pages: number): number {
    return padding.top + innerH - (pages / maxPages) * innerH;
  }

  const linePath = bars
    .map((b, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(1)},${scaleY(b.pages).toFixed(1)}`)
    .join(" ");
  const baseline = (padding.top + innerH).toFixed(1);
  const areaPath = `${linePath} L ${scaleX(bars.length - 1).toFixed(1)},${baseline} L ${scaleX(0).toFixed(1)},${baseline} Z`;

  const bestIndex = bestDate ? bars.findIndex((b) => b.date === bestDate) : -1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-32 w-full text-gold-ink sm:h-36">
      <path d={areaPath} fill="currentColor" stroke="none" opacity={0.16} />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} />
      {bestIndex >= 0 && (
        <circle cx={scaleX(bestIndex)} cy={scaleY(bars[bestIndex].pages)} r={4} fill="currentColor" />
      )}
    </svg>
  );
}
