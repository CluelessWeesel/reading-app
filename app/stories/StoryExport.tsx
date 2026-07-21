"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { StoryCard, EXPORT_WIDTH, EXPORT_HEIGHT } from "./StoryCard";
import type { StoryCardData, StoryTheme } from "./types";

const PREVIEW_WIDTH = 220;
const PREVIEW_SCALE = PREVIEW_WIDTH / EXPORT_WIDTH;
const PREVIEW_HEIGHT = EXPORT_HEIGHT * PREVIEW_SCALE;

// The card's own text sizes are viewport-relative (Tailwind's text-4xl
// etc.), not container-relative, so a genuinely small render would just
// overflow rather than scale down -- the preview instead renders the real
// 1080x1920 card and shrinks it visually with a CSS transform. The actual
// capture target is a SEPARATE, untransformed instance positioned off-
// screen: html-to-image (like most such libraries) sizes its output from
// the node's rendered bounding box, which a scaled ANCESTOR would shrink --
// keeping capture and preview as two different nodes sidesteps that
// entirely rather than fighting it.
export function StoryExport({
  card,
  theme,
  filename,
}: {
  card: StoryCardData;
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
      setError(err instanceof Error ? err.message : "Export failed -- one of this card's images may not allow cross-origin capture.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="overflow-hidden rounded-lg border border-gold shadow-md"
        style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
      >
        <div style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
          <StoryCard card={card} theme={theme} mode="export" />
        </div>
      </div>

      <div style={{ position: "fixed", top: 0, left: -9999, zIndex: -1 }} aria-hidden>
        <StoryCard ref={captureRef} card={card} theme={theme} mode="export" />
      </div>

      {error && <p className="max-w-xs text-center text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent transition disabled:opacity-50"
      >
        {downloading ? "Preparing..." : "Download PNG"}
      </button>
    </div>
  );
}
