"use client";

import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { ALL_TIERS } from "./types";
import type { TierBook, TierId } from "./types";

// Shown whenever a placement/move would push a tier over capacity -- shared
// by the opening fill (a tier-button tap) and the live board (a drag
// drop), since both funnel through the same /api/tier-board/place
// capacity check and get the same 409 back.
export function SwapPicker({
  tier,
  current,
  incomingTitle,
  onConfirm,
  onCancel,
  saving,
}: {
  tier: TierId;
  current: TierBook[];
  incomingTitle: string;
  onConfirm: (displacedBookId: number, displacedToTier: TierId) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [destTier, setDestTier] = useState<TierId>("holding");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gold bg-surface-1 p-5">
        <h2 className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>
          {tier} is full
        </h2>
        <p className="mt-1 text-sm text-ink-warm-faint">
          Placing &ldquo;{incomingTitle}&rdquo; here means something else has to leave. Pick one.
        </p>

        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gold p-1.5">
          {current.map((b) => (
            <button
              key={b.book_id}
              type="button"
              onClick={() => setSelected(b.book_id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                selected === b.book_id ? "bg-accent/10" : "hover:bg-hover"
              }`}
            >
              <CoverThumb title={b.title} coverUrl={b.cover_url} className="aspect-[2/3] w-7 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-warm">{b.title}</span>
            </button>
          ))}
        </div>

        {selected != null && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-ink-warm-faint">Send it to</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TIERS.filter((t) => t !== tier).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDestTier(t)}
                  aria-pressed={destTier === t}
                  className={`rounded-full border px-3 py-1 text-xs font-medium uppercase transition ${
                    destTier === t
                      ? "border-accent bg-accent/10 text-ink-warm"
                      : "border-gold text-ink-warm-faint hover:text-ink-warm"
                  }`}
                >
                  {t === "holding" ? "Holding" : t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-gold px-3 py-1.5 text-xs text-ink-warm-muted hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected == null || saving}
            onClick={() => selected != null && onConfirm(selected, destTier)}
            className="rounded-full bg-accent px-4 py-1.5 text-xs text-on-accent transition disabled:opacity-50"
          >
            {saving ? "Moving..." : "Confirm swap"}
          </button>
        </div>
      </div>
    </div>
  );
}
