import { fraunces } from "../../shared/fonts";
import { ordinal } from "../../books/[id]/format";
import type { RivalVerdictCardData } from "../types";

export function RivalVerdictCard({ card }: { card: RivalVerdictCardData }) {
  const max = Math.max(...card.bars.map((b) => b.pages), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">The rival verdict</p>

      <div className="space-y-2.5">
        {card.bars.map((b) => (
          <div key={b.year} className="flex items-center gap-3">
            <span className={`w-10 shrink-0 text-xs tabular-nums ${b.isCurrent ? "font-semibold text-gold-ink" : "opacity-60"}`}>
              {b.year}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-current/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${(b.pages / max) * 100}%`, backgroundColor: "var(--gold-ink)", opacity: b.isCurrent ? 1 : 0.35 }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums opacity-70">{b.pages.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {card.rank != null && (
        <p className={`${fraunces.className} text-center text-base italic`}>
          Your {ordinal(card.rank)}-best pace race of {card.total}
        </p>
      )}
    </div>
  );
}
