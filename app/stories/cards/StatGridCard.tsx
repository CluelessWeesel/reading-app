import { fraunces } from "../../shared/fonts";
import type { StatGridCardData } from "../types";

export function StatGridCard({ card }: { card: StatGridCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">{card.heading}</p>
      <div className="grid grid-cols-2 gap-x-10 gap-y-8">
        {card.stats.map((s) => (
          <div key={s.label}>
            <p className={`${fraunces.className} text-4xl font-semibold sm:text-5xl`}>{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wide opacity-60">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
