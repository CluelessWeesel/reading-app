import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { SeriesInFlight } from "../seriesInFlightMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <rect x="3" y="4" width="4" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="8" y="4" width="4" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="13" y="4" width="4" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
  </svg>
);

export function SeriesInFlightWidget({ series }: { series: SeriesInFlight[] | null }) {
  if (!series) return null;

  return (
    <WidgetCard title="Series in flight" accent="teal" icon={ICON} compact>
      <ul className="space-y-1">
        {series.map((s) => (
          <li key={s.series} className="truncate text-xs">
            <Link href={`/library?series=${encodeURIComponent(s.series)}`} className="text-ink-warm hover:underline">
              {s.series}
            </Link>{" "}
            <span className="text-ink-warm-faint">· #{s.rank}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

SeriesInFlightWidget.size = "compact" as const;
