"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { StoryCard, EXPORT_WIDTH } from "../../stories/StoryCard";
import type { StoryCardData, StoryTheme } from "../../stories/types";

// The one-image-for-the-whole-deck sibling to StoryExport's per-card
// download -- same off-screen, untransformed capture-target idea (see
// StoryExport for why it has to be a separate node rather than a scaled
// preview), just every card stacked into one tall column instead of one
// card at fixed dimensions. The output is intentionally huge (13 cards *
// 1920px) -- that's the actual "share the whole year as one strip" ask.
export function WrappedFullStripExport({
  cards,
  theme,
  filename,
}: {
  cards: StoryCardData[];
  theme: StoryTheme;
  filename: string;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!captureRef.current) return;
    setDownloading(true);
    setError(null);
    try {
      const dataUrl = await toPng(captureRef.current, { pixelRatio: 1, cacheBust: true });
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed -- one of this deck's images may not allow cross-origin capture.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ position: "fixed", top: 0, left: -9999, zIndex: -1 }} aria-hidden>
        <div ref={captureRef} style={{ width: EXPORT_WIDTH }}>
          {cards.map((card, i) => (
            <StoryCard key={i} card={card} theme={theme} mode="export" />
          ))}
        </div>
      </div>

      {error && <p className="max-w-xs text-center text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent transition disabled:opacity-50"
      >
        {downloading ? "Preparing full strip..." : "Download full strip"}
      </button>
    </div>
  );
}
