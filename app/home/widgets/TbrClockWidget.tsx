import { WidgetCard } from "./WidgetCard";
import { formatDateShort } from "../../shared/formatDateShort";
import type { TbrClock } from "../tbrClockMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 6 L10 10 L13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function TbrClockWidget({ clock }: { clock: TbrClock | null }) {
  if (!clock) return null;

  return (
    <WidgetCard title="TBR clock" accent="teal" icon={ICON} href="/tbr" compact>
      <p className="text-xl font-semibold tabular-nums text-accent-teal">{clock.daysRemaining}d</p>
      <p className="mt-1 text-[11px] text-ink-warm-faint">
        owned TBR left -- runs out {formatDateShort(clock.runOutDate)}
      </p>
    </WidgetCard>
  );
}

TbrClockWidget.size = "micro" as const;
