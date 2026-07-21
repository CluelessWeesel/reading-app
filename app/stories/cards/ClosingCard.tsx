import { fraunces } from "../../shared/fonts";
import type { ClosingCardData } from "../types";

export function ClosingCard({ card }: { card: ClosingCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <h2 className={`${fraunces.className} text-3xl font-semibold sm:text-4xl`}>{card.heading}</h2>
      <p className="max-w-sm text-sm opacity-70">{card.message}</p>
    </div>
  );
}
