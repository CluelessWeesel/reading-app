import { fraunces } from "../../shared/fonts";
import type { GenreMapCardData } from "../types";

const ACCENTS = ["blue", "purple", "green", "teal", "amber", "coral"];

export function GenreMapCard({ card }: { card: GenreMapCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">The genre map</p>

      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {card.slices.map((s, i) => (
          <div
            key={s.genre}
            style={{ width: `${s.percent}%`, backgroundColor: `var(--accent-${ACCENTS[i % ACCENTS.length]})` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {card.slices.map((s, i) => (
          <div key={s.genre} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--accent-${ACCENTS[i % ACCENTS.length]})` }}
            />
            <span className="opacity-80">{s.genre}</span>
            <span className="opacity-50">{Math.round(s.percent)}%</span>
          </div>
        ))}
      </div>

      <p className={`${fraunces.className} text-center text-lg italic text-gold-ink`}>{card.diagnosis}</p>
    </div>
  );
}
