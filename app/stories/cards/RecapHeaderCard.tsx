import { fraunces } from "../../shared/fonts";
import { CoverSplay } from "../CoverSplay";
import type { RecapHeaderCardData } from "../types";

export function RecapHeaderCard({ card }: { card: RecapHeaderCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <CoverSplay coverUrls={card.coverUrls} />
      <h1 className={`${fraunces.className} text-4xl font-semibold leading-tight sm:text-5xl`}>{card.monthLabel}</h1>
      {card.verdict && <p className={`${fraunces.className} text-lg italic opacity-75`}>{card.verdict}</p>}
      <p className="mt-2 text-xs uppercase tracking-[0.2em] opacity-50">Frozen {card.frozenDate}</p>
    </div>
  );
}
