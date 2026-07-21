import { WidgetCard } from "./WidgetCard";
import { RisersToggle } from "./RisersToggle";
import type { Riser } from "../risersMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M3 15 L8 9 L11.5 12 L17 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.5 5 L17 5 L17 9.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Window = "3" | "6" | "12";

// A plain server component -- the toggle/list interactivity lives in the
// leaf RisersToggle client component instead, for the same reason
// GenreDietWidget was restructured this way (see its comment for the
// full explanation of why a named export on a "use client" component
// doesn't survive being read from page.tsx).
export function RisersWidget({ risersByWindow }: { risersByWindow: Record<Window, Riser[] | null> }) {
  const anyData = risersByWindow["3"] || risersByWindow["6"] || risersByWindow["12"];
  if (!anyData) return null;

  return (
    <WidgetCard title="Risers" accent="green" icon={ICON} compact>
      <RisersToggle risersByWindow={risersByWindow} />
    </WidgetCard>
  );
}

export const RISERS_SIZE = "compact" as const;
