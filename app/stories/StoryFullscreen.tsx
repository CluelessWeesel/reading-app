"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StoryCard } from "./StoryCard";
import type { StoryCardData, StoryTheme } from "./types";

const SWIPE_THRESHOLD = 50; // px -- shorter drags are treated as a tap/scroll, not a page turn.

// The stepped "one card per screen" mode -- keyboard arrows, touch swipe,
// and click targets all funnel into the same goNext/goBack pair, and a
// progress-dot bar mirrors the finish-ceremony's ProgressDots in spirit
// (a lit segment per step) but themed for a fullscreen dark backdrop
// rather than a modal card. No existing swipe/arrow-key handling existed
// anywhere in this app to mirror -- this is genuinely new interaction code.
export function StoryFullscreen({
  cards,
  theme,
  onExit,
  banner,
}: {
  cards: StoryCardData[];
  theme: StoryTheme;
  onExit?: () => void;
  // An escape hatch for chrome that isn't per-card (Wrapped's "projected"
  // watermark while the year is still in progress) -- same spirit as
  // StoryDocument's renderCardFooter, just for the scrim instead of a card.
  banner?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  function goNext() {
    setIndex((i) => Math.min(cards.length - 1, i + 1));
  }
  function goBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "Escape") onExit?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX <= -SWIPE_THRESHOLD) goNext();
    else if (deltaX >= SWIPE_THRESHOLD) goBack();
    touchStartX.current = null;
  }

  const card: StoryCardData | undefined = cards[index];
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <StoryCard card={card} theme={theme} mode="fullscreen" />

      {/* Chrome (dots/buttons) sits on a scrim independent of the card's own
          theme -- a night card and a parchment card need the same controls
          to stay legible on top of them either way. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 to-transparent px-4 pb-8 pt-4">
        {banner && <div className="pointer-events-none mb-2 flex justify-center">{banner}</div>}
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= index ? "bg-white/90" : "bg-white/25"}`}
              />
            ))}
          </div>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              aria-label="Close"
              className="shrink-0 rounded-full bg-black/40 px-2.5 py-1 text-sm text-white/90 hover:bg-black/60"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={goBack}
        disabled={index === 0}
        aria-label="Previous card"
        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 px-3 py-4 text-xl text-white/80 hover:bg-black/50 disabled:opacity-0"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={goNext}
        disabled={index === cards.length - 1}
        aria-label="Next card"
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 px-3 py-4 text-xl text-white/80 hover:bg-black/50 disabled:opacity-0"
      >
        ›
      </button>
    </div>
  );
}
