"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { fraunces } from "@/app/shared/fonts";
import { RaceChart } from "./RaceChart";
import type { RaceLine } from "./RaceChart";

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
const PREVIEW_WIDTH = 220;
const PREVIEW_SCALE = PREVIEW_WIDTH / EXPORT_WIDTH;
const PREVIEW_HEIGHT = EXPORT_HEIGHT * PREVIEW_SCALE;

type CardData = {
  leftLabel: string;
  rightLabel: string;
  headline: string;
  leftLine: RaceLine;
  rightLine: RaceLine;
  domainMaxX: number;
  domainMaxY: number;
  leftBooks: number | null;
  rightBooks: number | null;
  leftPages: number | null;
  rightPages: number | null;
  leftAvgScore: number | null;
  rightAvgScore: number | null;
};

function Row({ label, leftValue, rightValue }: { label: string; leftValue: string; rightValue: string }) {
  return (
    <div className="flex items-center justify-between border-t border-gold py-3 text-2xl">
      <span className="text-ink-warm">{leftValue}</span>
      <span className="text-sm uppercase tracking-wide text-ink-warm-faint">{label}</span>
      <span className="text-ink-warm">{rightValue}</span>
    </div>
  );
}

// A condensed summary card, not a full-page screenshot -- all 7 sections
// stacked would produce an unusably tall image. Same html-to-image `toPng`
// pattern as app/stories/StoryExport.tsx: the visible preview is the real
// card shrunk with a CSS transform (its text sizes are fixed px, not
// container-relative, so a truly small render would just overflow); the
// actual capture target is a separate, untransformed, off-screen instance,
// since html-to-image sizes output from the node's real bounding box, which
// a scaled ancestor would shrink.
function CardContent({ data }: { data: CardData }) {
  const { leftLabel, rightLabel, headline, leftLine, rightLine, domainMaxX, domainMaxY, leftBooks, rightBooks, leftPages, rightPages, leftAvgScore, rightAvgScore } = data;
  return (
    <div className="flex flex-col justify-between bg-surface-2 p-14" style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}>
      <div>
        <p className="text-base uppercase tracking-[0.2em] text-ink-warm-faint">The Weeselry · Compare a Year</p>
        <h1 className={`${fraunces.className} mt-3 text-6xl font-semibold text-ink-warm`}>
          {leftLabel} vs {rightLabel}
        </h1>
      </div>

      <div style={{ width: EXPORT_WIDTH - 112, height: 420 }}>
        <RaceChart domainMaxX={domainMaxX} domainMaxY={domainMaxY} left={leftLine} right={rightLine} startLabel="Jan 1" endLabel="Dec 31" />
      </div>

      <p className={`${fraunces.className} text-3xl leading-snug text-ink-warm`}>{headline}</p>

      <div>
        <Row label="Books" leftValue={leftBooks != null ? String(leftBooks) : "--"} rightValue={rightBooks != null ? String(rightBooks) : "--"} />
        <Row label="Pages" leftValue={leftPages != null ? leftPages.toLocaleString() : "--"} rightValue={rightPages != null ? rightPages.toLocaleString() : "--"} />
        <Row label="Avg. score" leftValue={leftAvgScore != null ? leftAvgScore.toFixed(2) : "--"} rightValue={rightAvgScore != null ? rightAvgScore.toFixed(2) : "--"} />
      </div>
    </div>
  );
}

export function CompareShareCard({ data }: { data: CardData }) {
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
      link.download = `compare-${data.leftLabel}-vs-${data.rightLabel}.png`.replace(/\s+/g, "-").toLowerCase();
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-lg border border-gold shadow-md" style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}>
        <div style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
          <CardContent data={data} />
        </div>
      </div>

      <div style={{ position: "fixed", top: 0, left: -9999, zIndex: -1 }} aria-hidden>
        <div ref={captureRef}>
          <CardContent data={data} />
        </div>
      </div>

      {error && <p className="max-w-xs text-center text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent transition disabled:opacity-50"
      >
        {downloading ? "Preparing..." : "Download head-to-head image"}
      </button>
    </div>
  );
}
