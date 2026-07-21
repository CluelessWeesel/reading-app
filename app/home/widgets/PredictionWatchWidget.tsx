import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { PredictionWatch } from "../predictionWatchMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 2 L10 5 M10 15 L10 18 M2 10 L5 10 M15 10 L18 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function PredictionWatchWidget({ watch }: { watch: PredictionWatch | null }) {
  if (!watch) return null;

  return (
    <WidgetCard title="Prediction watch" accent="violet" icon={ICON} compact>
      <ul className="space-y-1">
        {watch.recent.map((r) => (
          <li key={r.bookId} className="truncate text-xs text-ink-warm-faint">
            <Link href={`/books/${r.bookId}`} className="text-ink-warm hover:underline">
              {r.title}
            </Link>{" "}
            · predicted <span className="font-semibold text-accent-violet">{r.predicted.toFixed(1)}</span>, got{" "}
            <span className="font-semibold text-accent-violet">{r.actual.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-warm-faint">
        All-time accuracy: off by <span className="font-semibold text-ink-warm">{watch.seasonAccuracy.toFixed(2)}</span> on
        average across {watch.seasonCount} prediction{watch.seasonCount === 1 ? "" : "s"}
      </p>
    </WidgetCard>
  );
}

PredictionWatchWidget.size = "compact" as const;
