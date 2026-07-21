import { WidgetCard } from "./WidgetCard";
import { BalanceToggle } from "./BalanceToggle";
import { BALANCE_WINDOWS } from "../balanceMath";
import type { BalanceWindow, BalanceWindowKey } from "../balanceMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M10 3 L10 17 M4 6 L16 6 M4 6 L2.5 10 L5.5 10 Z M16 6 L14.5 10 L17.5 10 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

// A plain server component -- the Type/Format + 3/6/12mo toggles'
// interactivity lives in the leaf BalanceToggle client component instead
// (see GenreDietWidget for why that split matters for BALANCE_SIZE's grid
// placement).
export function BalanceWidget({ windowsByN }: { windowsByN: Record<BalanceWindowKey, BalanceWindow | null> }) {
  const anyData = BALANCE_WINDOWS.some((w) => windowsByN[w]);
  if (!anyData) return null;

  return (
    <WidgetCard title="The Balance" accent="violet" icon={ICON}>
      <BalanceToggle windowsByN={windowsByN} />
    </WidgetCard>
  );
}

BalanceWidget.size = "feature" as const;
