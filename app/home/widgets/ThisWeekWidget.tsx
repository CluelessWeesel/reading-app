import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { ThisWeek } from "../thisWeekMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 8 L17 8" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export function ThisWeekWidget({ week }: { week: ThisWeek | null }) {
  if (!week) return null;

  const vsAvg = week.avgWeekPages > 0 ? Math.round(((week.pagesThisWeek - week.avgWeekPages) / week.avgWeekPages) * 100) : null;

  return (
    <WidgetCard title="This week" accent="blue" icon={ICON} compact>
      <p className="text-lg font-semibold tabular-nums text-accent-blue">{week.pagesThisWeek} pages</p>
      {vsAvg != null && (
        <p className="text-[11px] text-ink-warm-faint">
          {vsAvg >= 0 ? `${vsAvg}% above` : `${Math.abs(vsAvg)}% below`} your usual week
        </p>
      )}
      {week.finishesCount > 0 && (
        <p className="mt-1 text-[11px] text-ink-warm-faint">
          {week.finishesCount} book{week.finishesCount === 1 ? "" : "s"} finished
        </p>
      )}
      {week.rankMoves.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {week.rankMoves.slice(0, 2).map((m) => (
            <li key={m.bookId} className="truncate text-[11px] text-ink-warm-faint">
              <Link href={`/books/${m.bookId}`} className="text-ink-warm hover:underline">
                {m.title}
              </Link>{" "}
              {m.oldRank != null ? `#${m.oldRank} → #${m.newRank}` : `entered at #${m.newRank}`}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

ThisWeekWidget.size = "compact" as const;
