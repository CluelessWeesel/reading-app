import { WidgetCard } from "./WidgetCard";
import type { Countdown } from "../countdownMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M6 2 L6 5 M14 2 L14 5 M3 8 L17 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

function CountdownRow({ countdown }: { countdown: Countdown }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-ink-warm-faint">{countdown.label}</span>
      <span className="text-sm font-semibold tabular-nums text-accent-violet">
        {countdown.isNow ? "Now" : `${countdown.daysUntil}d`}
      </span>
    </div>
  );
}

export function CountdownsWidget({ weesels, wrapped }: { weesels: Countdown; wrapped: Countdown }) {
  return (
    <WidgetCard title="Countdowns" accent="violet" icon={ICON} compact>
      <div className="space-y-1.5">
        <CountdownRow countdown={weesels} />
        <CountdownRow countdown={wrapped} />
      </div>
    </WidgetCard>
  );
}

CountdownsWidget.size = "micro" as const;
