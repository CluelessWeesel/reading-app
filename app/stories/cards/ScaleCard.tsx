import { fraunces } from "../../shared/fonts";
import type { ScaleCardData } from "../types";

export function ScaleCard({ card }: { card: ScaleCardData }) {
  const pct = Math.min(100, card.landmarkRatio * 100);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">The scale</p>
      <p className={`${fraunces.className} text-4xl font-semibold text-gold-ink`}>{card.pages.toLocaleString()}</p>
      <p className="text-sm opacity-70">pages — stacked, that&apos;s {card.stackHeightMeters.toFixed(1)}m tall</p>

      <div className="flex h-36 w-9 items-end overflow-hidden rounded-sm border border-gold bg-current/5">
        <div className="w-full bg-gold-ink" style={{ height: `${pct}%`, opacity: 0.85 }} />
      </div>

      <p className={`${fraunces.className} max-w-[16rem] text-base italic`}>
        {card.landmarkRatio >= 1
          ? `Taller than ${card.landmarkName} (${card.landmarkRatio.toFixed(1)}x over)`
          : `${Math.round(card.landmarkRatio * 100)}% of the way up ${card.landmarkName}`}
      </p>

      <p className="text-xs opacity-60">{card.readingDaysThisYear} days with a page turned this year</p>
    </div>
  );
}
