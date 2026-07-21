import { fraunces } from "../../shared/fonts";
import type { QuoteCardData } from "../types";

export function QuoteCard({ card }: { card: QuoteCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <p className={`${fraunces.className} max-w-md text-2xl italic leading-relaxed sm:text-3xl`}>&ldquo;{card.text}&rdquo;</p>
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">{card.attribution}</p>
    </div>
  );
}
