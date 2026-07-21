import { fraunces } from "../../shared/fonts";
import type { RankedListCardData } from "../types";

export function RankedListCard({ card }: { card: RankedListCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">{card.heading}</p>
      <ol className="w-full max-w-sm space-y-3">
        {card.entries.map((e, i) => (
          <li key={`${e.label}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-current/15 pb-2">
            <span className="flex items-baseline gap-3 truncate">
              <span className={`${fraunces.className} text-lg font-semibold opacity-50`}>{i + 1}</span>
              <span className="truncate text-base">{e.label}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold opacity-70">{e.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
