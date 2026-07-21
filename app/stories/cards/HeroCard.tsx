import { fraunces } from "../../shared/fonts";
import { CoverSplay } from "../CoverSplay";
import type { HeroCardData } from "../types";

export function HeroCard({ card }: { card: HeroCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <CoverSplay coverUrls={card.coverUrls} />
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] opacity-60">{card.subtitle}</p>
        <h1 className={`${fraunces.className} text-4xl font-semibold leading-tight sm:text-5xl`}>{card.title}</h1>
      </div>
    </div>
  );
}
