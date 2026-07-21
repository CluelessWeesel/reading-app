import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import type { EpitaphCardData } from "../types";

export function EpitaphCard({ card }: { card: EpitaphCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      {card.coverUrl && (
        <CoverThumb title={card.attribution} coverUrl={card.coverUrl} className="aspect-[2/3] w-16 opacity-90 shadow-lg" />
      )}
      <p className={`${fraunces.className} max-w-xs text-xl italic`}>&ldquo;{card.text}&rdquo;</p>
      <p className="text-xs uppercase tracking-wide opacity-60">{card.attribution}</p>
      <p className={`${fraunces.className} mt-6 text-sm italic text-gold-ink`}>See you in January.</p>
    </div>
  );
}
