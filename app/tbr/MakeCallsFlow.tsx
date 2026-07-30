"use client";

import { useState } from "react";
import { fraunces } from "../shared/fonts";
import { CoverThumb } from "../shared/CoverThumb";
import { PredictionEntry } from "./PredictionEntry";
import type { TbrEntry } from "./types";

// Deals unpredicted TBR entries one at a time, same house pattern as the
// tier board's opening FillFlow (fixed full-screen overlay, one card at a
// time, explicit skip). Shows exactly cover/title/author/genre/length --
// deliberately nothing else that could bias the call. The queue starts as
// whatever TbrView already had loaded, filtered client-side, then shuffled
// so calls don't come in the underlying (alphabetical) list order; skipping
// is a genuine no-op (unlike FillFlow's "skip" which places into Holding),
// so a skipped book simply comes back next time "Make some calls" runs.
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function MakeCallsFlow({
  initialQueue,
  onPredicted,
  onDone,
}: {
  initialQueue: TbrEntry[];
  onPredicted: (entry: TbrEntry) => void;
  onDone: () => void;
}) {
  const [queue, setQueue] = useState(() => shuffled(initialQueue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalEligible] = useState(initialQueue.length);

  const current = queue[0] ?? null;
  const doneSoFar = totalEligible - queue.length;

  function advance() {
    setQueue((prev) => prev.slice(1));
    setError(null);
  }

  async function save(score: number, margin: number) {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tbr/${current.id}/predict`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predicted_score: score, predicted_margin: margin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed.");
      onPredicted({ ...current, ...body });
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!current) {
    return (
      <div className="story-theme-night story-card-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-ink-warm">
        <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">All called</p>
        <h1 className={`${fraunces.className} mt-3 text-3xl font-semibold text-gold-ink sm:text-4xl`}>
          {doneSoFar} call{doneSoFar === 1 ? "" : "s"} made
        </h1>
        <button
          type="button"
          onClick={onDone}
          className="mt-8 rounded-full bg-accent px-8 py-3 text-base font-semibold text-on-accent shadow-sm"
        >
          Back to TBR
        </button>
      </div>
    );
  }

  return (
    <div className="story-theme-night story-card-bg fixed inset-0 z-50 flex flex-col text-ink-warm">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-8">
        <p className="text-xs uppercase tracking-wide opacity-60">
          {doneSoFar} of {totalEligible} called
        </p>
        <button type="button" onClick={onDone} className="text-xs opacity-60 transition hover:opacity-100">
          Exit
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-6 text-center">
        <CoverThumb title={current.title} coverUrl={current.cover_url} className="aspect-[2/3] w-40 shadow-2xl sm:w-48" />
        <h2 className={`${fraunces.className} mt-6 text-2xl font-semibold sm:text-3xl`}>{current.title}</h2>
        {current.author && <p className="mt-1 text-sm opacity-70">{current.author}</p>}
        <p className="mt-1 text-xs opacity-50">
          {current.genre ?? "No genre"}
          {current.page_count != null ? ` · ${current.page_count} pg` : ""}
        </p>

        <div className="mt-8 w-full max-w-sm rounded-xl border border-white/15 bg-black/20 p-5 text-left">
          <PredictionEntry onSave={save} onSkip={advance} saving={saving} error={error} saveLabel="Save & next" />
        </div>
      </div>
    </div>
  );
}
