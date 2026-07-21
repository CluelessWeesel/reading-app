"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { StoryDocument } from "../StoryDocument";
import { StoryFullscreen } from "../StoryFullscreen";
import { StoryExport } from "../StoryExport";
import type { GeneratedStory, StoryMode, StoryTheme } from "../types";

type ViewMode = Extract<StoryMode, "stacked" | "fullscreen">;

function periodLabel(story: GeneratedStory): string {
  if (story.story_type === "wrapped") return story.period;
  const [y, m] = story.period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function StoryViewer({ story: initialStory }: { story: GeneratedStory }) {
  const router = useRouter();
  const [story, setStory] = useState(initialStory);
  const [viewMode, setViewMode] = useState<ViewMode>("stacked");
  // Recap defaults to the light document look, Wrapped to the ceremonial
  // night look -- both remain a free toggle, not a hard rule.
  const [theme, setTheme] = useState<StoryTheme>(story.story_type === "wrapped" ? "night" : "parchment");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(story.user_note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [exportOpenIndex, setExportOpenIndex] = useState<number | null>(null);

  async function handleRegenerate() {
    if (!window.confirm(`Re-freeze this ${story.story_type} from current data? This overwrites the existing cards.`)) {
      return;
    }
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

  async function handleDelete() {
    if (!window.confirm("Delete this story? This can't be undone.")) return;
    const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    if (res.ok) router.push("/stories");
  }

  const cards = story.payload.cards;

  if (viewMode === "fullscreen") {
    return <StoryFullscreen cards={cards} theme={theme} onExit={() => setViewMode("stacked")} />;
  }

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        <Link href="/stories" className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm">
          ← Stories
        </Link>

        <header className="mb-6 mt-3">
          <h1 className={`${fraunces.className} text-2xl font-semibold text-ink-warm sm:text-3xl`}>
            {periodLabel(story)}
            <span className="ml-2 align-middle rounded-full border border-gold px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">
              {story.story_type}
            </span>
          </h1>
          <p className="mt-1 text-xs text-ink-warm-faint">
            Generated {story.generated_at.slice(0, 10)} · frozen -- won&apos;t change unless you regenerate it
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border border-gold bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => setViewMode("stacked")}
              aria-pressed={viewMode === "stacked"}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                viewMode === "stacked" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
              }`}
            >
              Stacked
            </button>
            <button
              type="button"
              onClick={() => setViewMode("fullscreen")}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink-warm-muted transition hover:text-ink-warm"
            >
              Fullscreen
            </button>
          </div>

          <div className="flex gap-1 rounded-full border border-gold bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => setTheme("parchment")}
              aria-pressed={theme === "parchment"}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                theme === "parchment" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
              }`}
            >
              Parchment
            </button>
            <button
              type="button"
              onClick={() => setTheme("night")}
              aria-pressed={theme === "night"}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                theme === "night" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
              }`}
            >
              Night
            </button>
          </div>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="rounded-full border border-gold px-3 py-1.5 text-xs text-ink-warm-muted transition hover:text-ink-warm disabled:opacity-50"
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full px-3 py-1.5 text-xs text-red-600 underline decoration-dotted underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <StoryDocument
          cards={cards}
          theme={theme}
          renderCardFooter={(card, i) => (
            <div className="mt-2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setExportOpenIndex((prev) => (prev === i ? null : i))}
                className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                {exportOpenIndex === i ? "Hide export" : "Export this card"}
              </button>
              {exportOpenIndex === i && (
                <StoryExport card={card} theme={theme} filename={`${story.story_type}-${story.period}-${card.type}-${i}`} />
              )}
            </div>
          )}
        />

        <div className="mt-8 rounded-xl border border-gold bg-surface-1 p-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-ink-warm-faint" htmlFor="story-note">
            Note
          </label>
          <textarea
            id="story-note"
            className="w-full rounded-lg border border-gold bg-surface-1 px-2.5 py-1.5 text-sm text-ink-warm shadow-sm outline-none transition focus:ring-2 focus:ring-accent/40"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth remembering about this one..."
          />
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={savingNote || note === (story.user_note ?? "")}
            className="mt-2 rounded-full bg-accent px-4 py-1.5 text-xs text-on-accent transition disabled:opacity-50"
          >
            {savingNote ? "Saving..." : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}
