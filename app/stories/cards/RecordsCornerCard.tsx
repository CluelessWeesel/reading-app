import { fraunces } from "../../shared/fonts";
import type { RecordsCornerCardData } from "../types";

export function RecordsCornerCard({ card }: { card: RecordsCornerCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">Records corner</p>
      <div className="space-y-3">
        {card.entries.map((e, i) => (
          <div key={i} className="rounded-lg border border-current/15 px-3 py-2">
            <p className={`${fraunces.className} text-sm font-semibold`}>{e.label}</p>
            <p className="text-xs opacity-70">{e.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
