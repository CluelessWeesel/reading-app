import type { ReactNode } from "react";
import { StoryCard } from "./StoryCard";
import type { StoryCardData, StoryTheme } from "./types";

// The "stacked" mode: every card as its own bounded section in a normal
// scrolling page. No interactivity needed for the cards themselves, so
// this stays a plain server component -- StoryFullscreen (the other
// top-level mode) is the one that needs "use client" for its step-through
// state. renderCardFooter is an escape hatch for a caller (StoryViewer)
// that wants per-card chrome (an export toggle) without this component
// needing to know anything about export mode itself.
export function StoryDocument({
  cards,
  theme,
  renderCardFooter,
}: {
  cards: StoryCardData[];
  theme: StoryTheme;
  renderCardFooter?: (card: StoryCardData, index: number) => ReactNode;
}) {
  return (
    <div className="space-y-6">
      {cards.map((card, i) => (
        <div key={i}>
          <StoryCard card={card} theme={theme} mode="stacked" />
          {renderCardFooter?.(card, i)}
        </div>
      ))}
    </div>
  );
}
