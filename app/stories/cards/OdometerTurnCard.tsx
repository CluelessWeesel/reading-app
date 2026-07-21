import { fraunces } from "../../shared/fonts";
import type { OdometerTurnCardData } from "../types";

function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000).toLocaleString()}k`;
  return String(n);
}

export function OdometerTurnCard({ card }: { card: OdometerTurnCardData }) {
  const beforeThisYear = Math.max(0, card.lifetimePages - card.yearPages);
  const yearSharePercent = card.lifetimePages > 0 ? (card.yearPages / card.lifetimePages) * 100 : 0;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <p className={`${fraunces.className} text-lg italic opacity-70`}>Year {card.yearNumber} complete.</p>

      <div className="flex gap-8">
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold text-gold-ink`}>{card.lifetimeBooks.toLocaleString()}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Lifetime books</p>
        </div>
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold text-gold-ink`}>{card.lifetimePages.toLocaleString()}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Lifetime pages</p>
        </div>
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold text-gold-ink`}>{fmtWords(card.lifetimeWords)}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Lifetime words</p>
        </div>
      </div>

      {card.lifetimePages > 0 && (
        <div className="w-full max-w-xs">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-current/10">
            <div style={{ width: `${100 - yearSharePercent}%`, backgroundColor: "var(--accent-amber-chip)" }} />
            <div style={{ width: `${yearSharePercent}%`, backgroundColor: "var(--gold-ink)" }} />
          </div>
          <p className="mt-2 text-xs opacity-60">
            {beforeThisYear.toLocaleString()} before this year, {card.yearPages.toLocaleString()} added this year (
            {Math.round(yearSharePercent)}% of the lifetime total)
          </p>
        </div>
      )}
    </div>
  );
}
