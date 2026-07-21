"use client";

import { fraunces } from "../../shared/fonts";
import { useCountUp } from "../useCountUp";
import { CoverSplay } from "../CoverSplay";
import type { ColdOpenCardData, StoryMode } from "../types";

function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000).toLocaleString()}k`;
  return String(n);
}

export function ColdOpenCard({ card, mode }: { card: ColdOpenCardData; mode: StoryMode }) {
  const animate = mode !== "export";
  const books = useCountUp(card.books, animate);
  const pages = useCountUp(card.pages, animate);
  const words = useCountUp(card.words, animate, 1900);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <CoverSplay coverUrls={card.coverUrls} />
      <h1 className={`${fraunces.className} text-5xl font-semibold text-gold-ink sm:text-6xl`}>{card.year}.</h1>
      <p className={`${fraunces.className} text-2xl italic`}>You read.</p>
      <div className="mt-6 flex gap-8">
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold tabular-nums`}>{books.toLocaleString()}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Books</p>
        </div>
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold tabular-nums`}>{pages.toLocaleString()}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Pages</p>
        </div>
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold tabular-nums`}>{fmtWords(words)}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Words</p>
        </div>
      </div>
    </div>
  );
}
