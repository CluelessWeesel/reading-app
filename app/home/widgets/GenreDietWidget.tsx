import { WidgetCard } from "./WidgetCard";
import { GenreDietBar } from "./GenreDietBar";
import type { GenreDiet, IdleGenreFact } from "../genreDietMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M10 2 C10 6 6 6 6 10 C6 14 10 14 10 18 C10 14 14 14 14 10 C14 6 10 6 10 2 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

type Window = "3" | "6" | "12";

// A plain server component -- the window toggle/hover interactivity lives
// in the leaf GenreDietBar client component instead (see RhythmRibbon /
// RisersWidget for why a "use client" component here would break
// GENRE_DIET_SIZE's grid placement in page.tsx).
export function GenreDietWidget({
  dietByWindow,
  idleFact,
}: {
  dietByWindow: Record<Window, GenreDiet | null>;
  idleFact: IdleGenreFact | null;
}) {
  const anyData = dietByWindow["3"] || dietByWindow["6"] || dietByWindow["12"];
  if (!anyData) return null;

  return (
    <WidgetCard title="Genre diet" accent="coral" icon={ICON} compact>
      <GenreDietBar dietByWindow={dietByWindow} idleFact={idleFact} />
    </WidgetCard>
  );
}

export const GENRE_DIET_SIZE = "compact" as const;
