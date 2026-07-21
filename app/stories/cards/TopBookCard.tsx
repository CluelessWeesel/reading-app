import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import type { TopBookCardData } from "../types";

export function TopBookCard({ card }: { card: TopBookCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">{card.heading}</p>
      <CoverThumb title={card.title} coverUrl={card.coverUrl} className="aspect-[2/3] w-36 shadow-xl sm:w-44" />
      <div>
        <h2 className={`${fraunces.className} text-2xl font-semibold sm:text-3xl`}>{card.title}</h2>
        {card.author && <p className="mt-1 text-sm opacity-70">{card.author}</p>}
        {card.score != null && (
          <p className="mt-2 text-sm font-semibold opacity-80">{card.score.toFixed(1)} / 5</p>
        )}
      </div>
      {card.excerpt && (
        <p className={`${fraunces.className} max-w-md text-sm italic leading-relaxed opacity-75`}>&ldquo;{card.excerpt}&rdquo;</p>
      )}
    </div>
  );
}
