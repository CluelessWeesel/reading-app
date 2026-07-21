import { fraunces } from "../../shared/fonts";
import type { RecordsSetCardData } from "../types";

export function RecordsSetCard({ card }: { card: RecordsSetCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">Records set this year</p>
      <div className="space-y-3">
        {card.entries.map((e, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-gold px-3 py-2">
            <span className="text-xl">{e.emoji}</span>
            <div>
              <p className={`${fraunces.className} text-sm font-semibold text-gold-ink`}>{e.label}</p>
              <p className="text-xs opacity-70">{e.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
