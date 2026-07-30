"use client";

import { useState } from "react";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { BloodlineTree } from "./BloodlineTree";
import type { GatewayGraphSummary } from "./math";

export function BloodlineGrid({
  summary,
  onFocus,
  onOpenWholeDate,
}: {
  summary: GatewayGraphSummary;
  onFocus: (rootKey: string) => void;
  onOpenWholeDate: () => void;
}) {
  const [orphansOpen, setOrphansOpen] = useState(false);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Bloodlines</h2>
          <p className="mb-3 mt-0.5 text-xs text-ink-warm-faint">
            {summary.bloodlines.length} bloodline{summary.bloodlines.length === 1 ? "" : "s"}, sorted by size. Click one to
            focus it. Orphans held quietly below.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenWholeDate}
          className="shrink-0 whitespace-nowrap rounded-full border border-gold-strong bg-surface-2 px-3.5 py-1.5 text-xs text-ink-warm-muted transition hover:bg-gold-ink hover:text-white"
        >
          ↕ See the whole tree, by date
        </button>
      </div>

      {summary.bloodlines.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-warm-faint">
          No bloodlines yet -- every traced book so far found its own way in.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {summary.bloodlines.map((b) => (
            <button
              key={b.rootKey}
              type="button"
              onClick={() => onFocus(b.rootKey)}
              className="overflow-hidden rounded-xl border border-gold bg-surface-2 p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-ink-warm">{b.rootLabel}</span>
                <span className="shrink-0 text-xs text-ink-warm-faint">{b.size} books</span>
              </div>
              <div className="relative h-[170px] overflow-hidden">
                <BloodlineTree bloodline={b} variant="preview" mode="static" />
              </div>
            </button>
          ))}
        </div>
      )}

      {summary.orphans.length > 0 && (
        <div className="mt-5 border-t border-dashed border-gold-strong pt-3">
          <button
            type="button"
            onClick={() => setOrphansOpen((v) => !v)}
            className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
          >
            {orphansOpen ? "▾" : "▸"} {summary.orphans.length} orphan{summary.orphans.length === 1 ? "" : "s"} -- no gateway,
            nothing led from them yet
          </button>
          {orphansOpen && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {summary.orphans.map((o) => (
                <div
                  key={o.key}
                  className="flex items-center gap-1.5 rounded-full border border-gold bg-surface-1 py-1 pl-1 pr-2.5 text-xs text-ink-warm-muted"
                >
                  <CoverThumb title={o.title} coverUrl={o.coverUrl} className="aspect-[2/3] w-4" />
                  {o.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
