import { WidgetCard } from "./WidgetCard";
import { RhythmBar } from "./RhythmBar";
import type { RhythmNight } from "../rhythmMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M2 14 L6 8 L9 12 L13 4 L18 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function RhythmRibbon({ nights }: { nights: RhythmNight[] | null }) {
  if (!nights || nights.every((n) => n.pages === 0)) return null;

  const maxPages = Math.max(...nights.map((n) => n.pages), 1);
  // Today's pages get logged at the end of the day, so a same-day view
  // always sees it sitting at (or near) zero -- averaging it in would
  // drag the avg down for no real reason. Excluded from the average only;
  // still drawn as its own (outlined) bar, and still eligible for "best"
  // on the rare day it's already the highest so far.
  const completedNights = nights.filter((n) => !n.isToday);
  const avg =
    completedNights.length > 0
      ? Math.round(completedNights.reduce((sum, n) => sum + n.pages, 0) / completedNights.length)
      : 0;
  const best = Math.max(...nights.map((n) => n.pages));

  return (
    <WidgetCard
      title="Last 14 nights"
      accent="blue"
      icon={ICON}
      headerRight={
        <span className="text-xs text-ink-warm-faint">
          avg <span className="font-semibold text-ink-warm">{avg}</span> · best{" "}
          <span className="font-semibold text-ink-warm">{best}</span>
        </span>
      }
    >
      <div className="flex h-20 items-end gap-1.5 sm:gap-2">
        {nights.map((night) => (
          <RhythmBar key={night.date} night={night} heightPercent={Math.max(4, (night.pages / maxPages) * 100)} />
        ))}
      </div>
    </WidgetCard>
  );
}

RhythmRibbon.size = "wide" as const;
