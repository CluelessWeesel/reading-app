"use client";

import { useMemo, useState } from "react";
import { BloodlineTree } from "./BloodlineTree";
import { nodeLabel, type Bloodline, type GraphNode } from "./math";

type Mode = "explore" | "trace";

function pathToRoot(bloodline: Bloodline, leafKey: string): string[] {
  const byKey = new Map(bloodline.nodes.map((n) => [n.node.key, n]));
  const path: string[] = [];
  let cur: string | undefined = leafKey;
  while (cur) {
    path.push(cur);
    cur = byKey.get(cur)?.parentKey ?? undefined;
  }
  return path;
}

export function FocusedBloodline({ bloodline, onBack }: { bloodline: Bloodline; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("explore");
  const [selectedLeafKey, setSelectedLeafKey] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const byKey = useMemo(() => new Map(bloodline.nodes.map((n) => [n.node.key, n.node])), [bloodline]);

  const tracePath = selectedLeafKey ? pathToRoot(bloodline, selectedLeafKey) : null;
  const dimKeys = mode === "trace" && tracePath ? new Set(tracePath) : null;

  function handleSelectNode(node: GraphNode) {
    setSelectedLeafKey(node.key);
  }

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "explore") setSelectedLeafKey(null);
  }

  function handleBack() {
    setFullscreen(false);
    onBack();
  }

  // Canvas height scales with generation count -- an even row per level,
  // so a chain of N books is always just as legible regardless of how the
  // actual read dates happened to fall.
  const height = Math.max(240, (bloodline.depth + 1) * 110);

  // Width scales with how many branch-tips this bloodline actually has --
  // fitting every leaf into whatever column width happened to be available
  // is what made wide, bushy bloodlines look cramped. Wrapped in its own
  // horizontally scrollable box below rather than shrinking to fit.
  const width = Math.max(320, bloodline.leafCount * 85);

  const canvas = (
    <div className="relative mx-auto" style={{ width, height, minWidth: "100%" }}>
      <BloodlineTree
        bloodline={bloodline}
        variant="focused"
        mode={mode}
        dimKeys={dimKeys}
        selectedKey={selectedLeafKey}
        onSelectNode={handleSelectNode}
      />
    </div>
  );

  const caption = (
    <p className="mt-2.5 text-center text-sm italic leading-relaxed text-ink-warm-muted" style={{ fontFamily: "Georgia, serif" }}>
      {mode === "trace" &&
        (tracePath
          ? tracePath.map((k) => nodeLabel(byKey.get(k)!)).join(" ← ")
          : "Pick a book to trace its chain back to where it started.")}
    </p>
  );

  const headerRow = (
    <div className="mb-3 flex items-center justify-between">
      <button
        type="button"
        onClick={handleBack}
        className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
      >
        ← All bloodlines
      </button>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => changeMode("explore")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            mode === "explore" ? "border-transparent bg-accent text-on-accent" : "border-gold bg-surface-1 text-ink-warm-muted"
          }`}
        >
          Explore
        </button>
        <button
          type="button"
          onClick={() => changeMode("trace")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            mode === "trace" ? "border-transparent bg-accent text-on-accent" : "border-gold bg-surface-1 text-ink-warm-muted"
          }`}
        >
          Trace to origin
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="rounded-full border border-gold bg-surface-1 px-3 py-1 text-xs text-ink-warm-muted transition hover:bg-surface-2 hover:text-ink-warm"
        >
          {fullscreen ? "✕ Exit fullscreen" : "⛶ Expand"}
        </button>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-paper px-4 py-4 sm:px-8 sm:py-6">
        {headerRow}
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gold bg-surface-2 px-3 py-5">{canvas}</div>
        {caption}
      </div>
    );
  }

  return (
    <div>
      {headerRow}
      {/* Bounded height + overflow-auto on BOTH axes, not "let the page grow
          tall and only constrain x" -- tried that (overflow-x-auto with
          overflow-y-hidden/-clip) and it created a dead zone where the
          mouse wheel just did nothing while hovered over the canvas
          (confirmed by hand: overflow-clip fell back to hidden in this
          browser, same bug). A genuinely bounded scroll box has no such
          ambiguity -- wheel input over it always scrolls it, in whichever
          direction there's room, same as any normal scrollable panel. */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-gold bg-surface-2 px-3 py-5">{canvas}</div>
      {caption}
    </div>
  );
}
