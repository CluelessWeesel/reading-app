import { fraunces } from "../../shared/fonts";
import type { AuthorOfYearCardData } from "../types";

export function AuthorOfYearCard({ card }: { card: AuthorOfYearCardData }) {
  const initial = card.author.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">Author of the year</p>

      {card.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.photoUrl}
          alt={card.author}
          className="h-24 w-24 rounded-full border-2 border-gold object-cover shadow-lg"
        />
      ) : (
        <div
          className={`${fraunces.className} flex h-24 w-24 items-center justify-center rounded-full border-2 border-gold bg-current/10 text-3xl font-semibold text-gold-ink`}
        >
          {initial}
        </div>
      )}

      <p className={`${fraunces.className} text-2xl font-semibold`}>{card.author}</p>
      <p className="text-sm opacity-70">
        {card.pages.toLocaleString()} pages across {card.books} book{card.books === 1 ? "" : "s"}
      </p>

      {card.runnerUp && (
        <p className="text-xs italic opacity-50">
          Runner-up: {card.runnerUp.author} ({card.runnerUp.pages.toLocaleString()} pages)
        </p>
      )}
    </div>
  );
}
