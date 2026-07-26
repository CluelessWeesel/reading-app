"use client";

import { useEffect, useState } from "react";
import { fraunces } from "../shared/fonts";
import { PredictionEntry } from "./PredictionEntry";
import type { TbrEntry } from "./types";

// Row-triggered entry/edit surface -- deliberately a small dedicated modal
// rather than the full TbrEntryModal (which requires resending every
// field). `revealed` controls whether the current value prefills: only
// true when the caller is already showing predictions (the "show
// predictions" toggle is on) -- otherwise this always starts blank, even
// for a row that already has one, so re-opening it can't leak a forgotten
// call.
export function PredictionModal({
  entry,
  revealed,
  onClose,
  onSaved,
}: {
  entry: TbrEntry;
  revealed: boolean;
  onClose: () => void;
  onSaved: (entry: TbrEntry) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function save(score: number, margin: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tbr/${entry.id}/predict`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predicted_score: score, predicted_margin: margin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed.");
      onSaved({ ...entry, ...body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-sm rounded-xl border border-gold bg-surface-3 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="predict-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="predict-title" className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>
              {entry.title}
            </h2>
            <p className="text-xs text-ink-warm-faint">Sealed until you finish it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-ink-warm-faint hover:bg-hover hover:text-ink-warm"
          >
            ✕
          </button>
        </div>

        <PredictionEntry
          initialScore={revealed ? entry.predicted_score : null}
          initialMargin={revealed ? entry.predicted_margin : null}
          onSave={save}
          onSkip={onClose}
          saving={saving}
          error={error}
        />
      </div>
    </div>
  );
}
