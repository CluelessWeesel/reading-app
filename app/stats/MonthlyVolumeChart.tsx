import { useRef, useState } from "react";
import { ChartTooltip } from "./ChartTooltip";
import type { Bucket } from "./distributionMath";

type Hover = { bucket: Bucket; x: number; y: number };

// A bigger, hand-rolled bar chart (not DistributionCard's small-tile
// layout) with a floating tooltip board on hover showing the value plus a
// few of the contributing books, rather than a plain caption.
export function MonthlyVolumeChart({
  buckets,
  valueOf,
  formatValue,
}: {
  buckets: Bucket[];
  valueOf: (b: Bucket) => number;
  formatValue: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const maxValue = Math.max(1, ...buckets.map(valueOf));

  function handleEnter(e: React.MouseEvent, bucket: Bucket) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ bucket, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-64 items-end gap-1 sm:h-80">
        {buckets.map((b) => {
          const value = valueOf(b);
          const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const isHovered = hover?.bucket === b;
          return (
            <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <button
                type="button"
                aria-label={b.label}
                disabled={value === 0}
                className={`w-full rounded-t transition ${isHovered ? "bg-accent" : "bg-accent/45 hover:bg-accent/70"}`}
                style={{ height: `${pct}%` }}
                onMouseEnter={(e) => handleEnter(e, b)}
                onMouseLeave={() => setHover((h) => (h?.bucket === b ? null : h))}
              />
              <span className="w-full truncate text-center text-[9px] text-ink-warm-faint">{b.label}</span>
            </div>
          );
        })}
      </div>

      {hover && (
        <ChartTooltip x={hover.x} y={hover.y}>
          <p className="font-semibold">{hover.bucket.label}</p>
          <p className="text-ink-warm-faint">{formatValue(valueOf(hover.bucket))}</p>
          {hover.bucket.books.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-ink-warm-faint">
              {hover.bucket.books.slice(0, 3).map((bk) => (
                <li key={bk.book_id} className="truncate">
                  {bk.title}
                </li>
              ))}
              {hover.bucket.books.length > 3 && <li>+{hover.bucket.books.length - 3} more</li>}
            </ul>
          )}
        </ChartTooltip>
      )}
    </div>
  );
}
