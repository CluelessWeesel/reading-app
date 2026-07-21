"use client";

import Link from "next/link";
import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { StoryDocument } from "../../stories/StoryDocument";
import { StoryFullscreen } from "../../stories/StoryFullscreen";
import { StoryExport } from "../../stories/StoryExport";
import { WrappedFullStripExport } from "./WrappedFullStripExport";
import type { GeneratedStory } from "../../stories/types";

// Always night -- the ceremonial counterpart to a recap's parchment
// document, never toggled.
const THEME = "night" as const;

function ProjectedBadge() {
  return (
    <span className="rounded-full border border-gold bg-black/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gold-ink">
      Projected -- final Jan 1
    </span>
  );
}

export function WrappedViewer({ story: initialStory }: { story: GeneratedStory }) {
  const [story, setStory] = useState(initialStory);
  const [mode, setMode] = useState<"stacked" | "fullscreen">("fullscreen");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOpenIndex, setExportOpenIndex] = useState<number | null>(null);

  const isFinal = story.payload.final !== false;
  const cards = story.payload.cards;

  async function handleRegenerate() {
    if (!window.confirm(`Re-freeze ${story.period} Wrapped from current data? This overwrites the existing cards.`)) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${story.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Regenerate failed.");
      setStory(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed.");
    } finally {
      setRegenerating(false);
    }
  }

  if (mode === "fullscreen") {
    return (
      <StoryFullscreen
        cards={cards}
        theme={THEME}
        onExit={() => setMode("stacked")}
        banner={!isFinal ? <ProjectedBadge /> : undefined}
      />
    );
  }

  return (
    <div className="story-theme-night story-card-bg min-h-full flex-1 px-4 py-8 text-ink-warm sm:px-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        <Link href="/wrapped" className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm">
          ← Wrapped
        </Link>

        <div className="mb-2 mt-4 flex flex-wrap items-center gap-2">
          <h1 className={`${fraunces.className} text-2xl font-semibold`}>{story.period} Wrapped</h1>
          {!isFinal && <ProjectedBadge />}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("fullscreen")}
            className="rounded-full border border-gold px-3 py-1.5 text-xs text-ink-warm-muted transition hover:text-ink-warm"
          >
            Fullscreen
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="rounded-full border border-gold px-3 py-1.5 text-xs text-ink-warm-muted transition hover:text-ink-warm disabled:opacity-50"
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mb-6">
          <WrappedFullStripExport cards={cards} theme={THEME} filename={`wrapped-${story.period}`} />
        </div>

        <StoryDocument
          cards={cards}
          theme={THEME}
          renderCardFooter={(card, i) => (
            <div className="mt-2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setExportOpenIndex((prev) => (prev === i ? null : i))}
                className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                {exportOpenIndex === i ? "Hide export" : "Export this card"}
              </button>
              {exportOpenIndex === i && <StoryExport card={card} theme={THEME} filename={`wrapped-${story.period}-${card.type}-${i}`} />}
            </div>
          )}
        />
      </div>
    </div>
  );
}
