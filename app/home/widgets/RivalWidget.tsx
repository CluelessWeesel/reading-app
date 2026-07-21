import { WidgetCard } from "./WidgetCard";
import { formatPagesK } from "../../stats/statsMath";
import type { RivalData } from "../rivalMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M10 3 L10 17 M4 6 L16 6 M4 14 L16 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export function RivalWidget({ rival, currentYear }: { rival: RivalData | null; currentYear: number }) {
  if (!rival) return null;

  const max = Math.max(rival.currentPages, rival.rivalPages, 1);
  const aheadBy = Math.abs(rival.delta);
  const headline =
    rival.delta === 0
      ? `Dead even with ${rival.rivalYear}`
      : rival.delta > 0
        ? `${formatPagesK(aheadBy)} pages ahead of ${rival.rivalYear}`
        : `${formatPagesK(aheadBy)} pages behind ${rival.rivalYear}`;

  return (
    <WidgetCard title="Rivalry" accent="pink" icon={ICON}>
      <p className="mb-4 text-sm text-ink-warm">{headline}</p>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs text-ink-warm-faint">
            <span>{currentYear}</span>
            <span className="tabular-nums">{formatPagesK(rival.currentPages)} pages</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-accent-pink-chip">
            <div
              className="h-full rounded-full bg-accent-pink"
              style={{ width: `${(rival.currentPages / max) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs text-ink-warm-faint">
            <span>{rival.rivalYear}</span>
            <span className="tabular-nums">{formatPagesK(rival.rivalPages)} pages</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-accent-pink-chip">
            <div
              className="h-full rounded-full opacity-50"
              style={{ width: `${(rival.rivalPages / max) * 100}%`, backgroundColor: "var(--accent-pink)" }}
            />
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-warm-faint">Both measured through day {rival.dayOfYear + 1} of the year.</p>
    </WidgetCard>
  );
}

RivalWidget.size = "feature" as const;
