import { MemoryPenFeature } from "./MemoryPenFeature";
import { OnThisDayWidget } from "./OnThisDayWidget";
import { AnniversariesWidget } from "./AnniversariesWidget";
import { FavoritePromptWidget } from "./FavoritePromptWidget";
import type { MemoryPen, OnThisDayEntry, Anniversary } from "../memoryMath";

// Composes the feature quote with its stacked compacts into one bespoke
// two-column layout (not the uniform Section grid -- this one genuinely
// needs a taller left column with a vertical stack beside it, which plain
// column-spans can't express), then gets placed as a single "wide" item in
// MEMORY's Section so it still gets the shared label/divider chrome.
// Favourite Prompt is the third stack slot specifically because On This
// Day/Anniversaries need a near-exact calendar match and can still both
// come up empty on plenty of days -- Favourite Prompt is a standing stat,
// always there once any prompts exist, so the stack (and the space beside
// the feature quote) isn't left half-empty on those days.
export function MemoryFeatureGroup({
  memory,
  onThisDay,
  anniversaries,
  favoritePrompt,
}: {
  memory: MemoryPen | null;
  onThisDay: OnThisDayEntry[] | null;
  anniversaries: Anniversary[] | null;
  favoritePrompt: { question: string; count: number } | null;
}) {
  const hasStackContent =
    (onThisDay && onThisDay.length > 0) || (anniversaries && anniversaries.length > 0) || favoritePrompt != null;
  if (!memory && !hasStackContent) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <MemoryPenFeature memory={memory} />
      </div>
      <div className="flex flex-col gap-4">
        <OnThisDayWidget entries={onThisDay} />
        <AnniversariesWidget anniversaries={anniversaries} />
        <FavoritePromptWidget prompt={favoritePrompt} />
      </div>
    </div>
  );
}

MemoryFeatureGroup.size = "wide" as const;
