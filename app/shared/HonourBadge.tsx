import { InfoTooltip } from "./InfoTooltip";

export type HonourItem = { year: number; category: string; result: "winner" | "nominee" };

// The one shared crown/laurel visual, reused everywhere a book or author's
// weesels history surfaces (rankings rows, author/book headers, home). A
// win shows 🏆 with a count; the laurel shows total nominations -- wins
// included, same "N wins from M nominations" convention real awards use, not
// just the ones that didn't win. Both share one InfoTooltip listing every
// year/category on hover or tap.
export function HonourBadge({ items }: { items: HonourItem[] }) {
  if (items.length === 0) return null;

  const wins = items.filter((i) => i.result === "winner");

  const tooltipText = items
    .slice()
    .sort((a, b) => b.year - a.year || a.category.localeCompare(b.category))
    .map((i) => `${i.year} — ${i.category}${i.result === "winner" ? " (winner)" : ""}`)
    .join("\n");

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-warm-faint">
      {wins.length > 0 && <span className="font-medium text-ink-warm">🏆 {wins.length}</span>}
      <span>🏵️ {items.length}</span>
      <InfoTooltip text={tooltipText} />
    </span>
  );
}
