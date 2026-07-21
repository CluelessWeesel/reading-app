import { WidgetCard } from "./WidgetCard";
import type { Velocity } from "../velocityMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M4 14 A 7 7 0 0 1 16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 14 L13 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function VelocityGaugeWidget({ velocity }: { velocity: Velocity | null }) {
  if (!velocity) return null;

  const arcPercent = Math.min(100, velocity.percent);

  return (
    <WidgetCard title="Velocity" accent="green" icon={ICON} compact>
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 100 56" width="92" height="52" aria-hidden>
          <path
            d="M 8 50 A 42 42 0 0 1 92 50"
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth="9"
            strokeLinecap="round"
            pathLength={100}
          />
          <path
            d="M 8 50 A 42 42 0 0 1 92 50"
            fill="none"
            stroke="var(--accent-green)"
            strokeWidth="9"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - arcPercent}
            style={{ filter: "drop-shadow(0 0 4px var(--accent-green))" }}
          />
        </svg>
        <p className="-mt-4 text-lg font-semibold tabular-nums text-accent-green">{Math.round(velocity.percent)}%</p>
        <p className="mt-1 text-[11px] text-ink-warm-faint">
          {velocity.pagesPerDay.toFixed(1)} vs {velocity.targetPagesPerDay.toFixed(1)} pg/day
        </p>
      </div>
    </WidgetCard>
  );
}

VelocityGaugeWidget.size = "micro" as const;
