import { fraunces } from "../../shared/fonts";
import { ordinal } from "../../books/[id]/format";
import type { VsMonthsPastCardData } from "../types";

// "Odometer at right" per spec assumes a wide layout -- these cards are
// portrait (stacked/fullscreen/export are all narrow-first), so it sits
// beneath the bars instead, same information, just stacked vertically.
export function VsMonthsPastCard({ card }: { card: VsMonthsPastCardData }) {
  const max = Math.max(...card.bars.map((b) => b.pages), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">
        {card.monthName}s past
      </p>

      <div className="space-y-2.5">
        {card.bars.map((b) => (
          <div key={b.year} className="flex items-center gap-3">
            <span className={`w-10 shrink-0 text-xs tabular-nums ${b.isCurrent ? "font-semibold" : "opacity-60"}`}>
              {b.year}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-current/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(b.pages / max) * 100}%`,
                  backgroundColor: "var(--accent-blue)",
                  opacity: b.isCurrent ? 1 : 0.35,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums opacity-70">{b.pages.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {card.rank != null && (
        <p className="text-center text-sm">
          Your <span className="font-semibold">{ordinal(card.rank)}</span>-best {card.monthName} of {card.total}
          {card.distanceToRecordPages != null && (
            <span className="opacity-70"> · {card.distanceToRecordPages.toLocaleString()} pages short of the record</span>
          )}
        </p>
      )}

      <div className="flex justify-center gap-6 border-t border-current/15 pt-4 text-center">
        <div>
          <p className={`${fraunces.className} text-lg font-semibold`}>{card.odometer.books.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wide opacity-60">Lifetime books</p>
        </div>
        <div>
          <p className={`${fraunces.className} text-lg font-semibold`}>{card.odometer.pages.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wide opacity-60">Lifetime pages</p>
        </div>
      </div>
    </div>
  );
}
