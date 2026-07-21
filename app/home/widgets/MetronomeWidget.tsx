import { WidgetCard } from "./WidgetCard";
import { MetronomeChart } from "./MetronomeChart";
import type { Metronome } from "../metronomeMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M6 17 L10 4 L14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 12.5 L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="6" r="1.4" fill="currentColor" />
  </svg>
);

// No hover here (the endpoint label is always visible, per spec), so this
// stays a plain server component.
export function MetronomeWidget({ metronome }: { metronome: Metronome | null }) {
  if (!metronome) return null;

  return (
    <WidgetCard
      title="The Metronome"
      accent="coral"
      icon={ICON}
      headerRight={<span className="text-xs font-medium text-ink-warm">{metronome.verdict}</span>}
    >
      <MetronomeChart points={metronome.points} cruise={metronome.cruise} current={metronome.current} />
      <p className="mt-1 text-[11px] text-ink-warm-faint">{metronome.annotation}</p>
    </WidgetCard>
  );
}

MetronomeWidget.size = "feature" as const;
