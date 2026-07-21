"use client";

import { useState } from "react";
import Link from "next/link";
import type { Riser } from "../risersMath";

type Window = "3" | "6" | "12";

const WINDOW_LABELS: Record<Window, string> = { "3": "3mo", "6": "6mo", "12": "12mo" };

// The interactive leaf: the window toggle + resulting list. Split out
// from RisersWidget so that component can stay a plain server component
// -- see RisersWidget.tsx for why that matters.
export function RisersToggle({ risersByWindow }: { risersByWindow: Record<Window, Riser[] | null> }) {
  const [window, setWindow] = useState<Window>("6");
  const risers = risersByWindow[window];

  return (
    <>
      <div className="mb-2 flex gap-1">
        {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            aria-pressed={window === w}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              window === w ? "bg-accent-green text-on-accent" : "text-ink-warm-faint hover:text-ink-warm"
            }`}
          >
            {WINDOW_LABELS[w]}
          </button>
        ))}
      </div>

      {risers ? (
        <ul className="space-y-1.5">
          {risers.map((r) => (
            <li key={r.author} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                {r.authorId != null ? (
                  <Link href={`/authors/${r.authorId}`} className="truncate text-ink-warm hover:underline">
                    {r.author}
                  </Link>
                ) : (
                  <span className="truncate text-ink-warm">{r.author}</span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-accent-green">
                #{r.rankBefore} → #{r.rankNow}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-warm-faint">No climbers over this window.</p>
      )}
      <p className="mt-2 text-[11px] text-ink-warm-faint">Pages-leaderboard position</p>
    </>
  );
}
