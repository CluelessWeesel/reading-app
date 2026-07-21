"use client";

import Link from "next/link";
import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { StoryDocument } from "../../stories/StoryDocument";
import { StoryFullscreen } from "../../stories/StoryFullscreen";
import { StoryExport } from "../../stories/StoryExport";
import type { GeneratedStory } from "../../stories/types";

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Always parchment -- the "document" look is the whole point of a recap
// (Wrapped is the ceremonial night counterpart, built on the same engine).
const THEME = "parchment" as const;

export function RecapViewer({ story: initialStory }: { story: GeneratedStory }) {
  const [story, setStory] = useState(initialStory);
  const [mode, setMode] = useState<"stacked" | "fullscreen">("stacked");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(story.user_note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [exportOpenIndex, setExportOpenIndex] = useState<number | null>(null);

  async function handleRegenerate() {
    if (!window.confirm(`Re-freeze ${monthLabel(story.period)} from current data? This overwrites the existing cards.`)) return;
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

  async function handleSaveNote() {
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_note: note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed.");
      setStory((prev) => ({ ...prev, user_note: body.user_note }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingNote(false);
    }
  }

  const cards = story.payload.cards;

  if (mode === "fullscreen") {
    return <StoryFullscreen cards={cards} theme={THEME} onExit={() => setMode("stacked")} />;
  }

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        <Link href="/recaps" className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm">
          ← Recaps
        </Link>

        <div className="mb-6 mt-4 flex flex-wrap items-center gap-2">
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
              {exportOpenIndex === i && <StoryExport card={card} theme={THEME} filename={`recap-${story.period}-${card.type}-${i}`} />}
            </div>
          )}
        />

        {/* Section 9: Your Note -- the only field on a frozen recap that
            stays mutable forever, deliberately styled apart from the
            frozen cards above (a single italic serif line, not a card). */}
        <div className="mt-8 border-t border-gold pt-6 text-center">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (story.user_note ?? "") && handleSaveNote()}
            placeholder="Add a note about this month..."
            className={`${fraunces.className} w-full bg-transparent text-center text-base italic text-ink-warm placeholder:text-ink-warm-faint focus:outline-none`}
          />
          {savingNote && <p className="mt-1 text-[10px] text-ink-warm-faint">Saving...</p>}
        </div>
      </div>
    </div>
  );
}
