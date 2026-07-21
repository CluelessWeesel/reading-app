import { WidgetCard } from "./WidgetCard";
import type { FiveStarDrought } from "../fiveStarDroughtMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden>
    <path d="M10 2.5 L12.2 7.4 L17.5 8.1 L13.7 11.7 L14.7 17 L10 14.3 L5.3 17 L6.3 11.7 L2.5 8.1 L7.8 7.4 Z" />
  </svg>
);

export function FiveStarDroughtWidget({ drought }: { drought: FiveStarDrought | null }) {
  if (!drought) return null;

  return (
    <WidgetCard title="Five-star drought" accent="amber" icon={ICON} compact>
      <p className="text-xl font-semibold tabular-nums text-accent-amber">{drought.daysSince}d</p>
      <p className="mt-1 text-[11px] text-ink-warm-faint">
        {drought.booksSince} book{drought.booksSince === 1 ? "" : "s"} since {drought.lastTitle}
      </p>
      <p className="mt-1.5 border-t border-gold pt-1.5 text-[11px] text-ink-warm-faint">
        {drought.isCurrentRecord ? "Longest drought yet -- happening now" : `Record: ${drought.recordDays}d`}
      </p>
    </WidgetCard>
  );
}

FiveStarDroughtWidget.size = "micro" as const;
