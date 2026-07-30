"use client";

import { useState, type ReactNode } from "react";

type Tab = "stories" | "graph";

// Both tabs stay mounted and are shown/hidden with `hidden` rather than
// conditionally rendered -- the Gateway Graph tab holds its own focus/mode
// state (which bloodline is open, explore vs. trace-to-origin) that
// shouldn't reset just because you glanced at Stories and back.
export function StoriesTabs({ stories, graph }: { stories: ReactNode; graph: ReactNode }) {
  const [tab, setTab] = useState<Tab>("stories");

  return (
    <div>
      <div className="mx-auto mb-8 flex max-w-3xl gap-3">
        <button
          type="button"
          onClick={() => setTab("stories")}
          aria-pressed={tab === "stories"}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
            tab === "stories"
              ? "border-accent bg-accent text-on-accent shadow-sm"
              : "border-gold bg-surface-1 text-ink-warm-muted hover:bg-hover"
          }`}
        >
          Stories
        </button>
        <button
          type="button"
          onClick={() => setTab("graph")}
          aria-pressed={tab === "graph"}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
            tab === "graph"
              ? "border-accent bg-accent text-on-accent shadow-sm"
              : "border-gold bg-surface-1 text-ink-warm-muted hover:bg-hover"
          }`}
        >
          Gateway Graph
        </button>
      </div>

      <div className={tab === "stories" ? "" : "hidden"}>{stories}</div>
      <div className={tab === "graph" ? "" : "hidden"}>{graph}</div>
    </div>
  );
}
