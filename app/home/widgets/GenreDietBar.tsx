"use client";

import { useState } from "react";
import type { GenreDiet, IdleGenreFact } from "../genreDietMath";

type Window = "3" | "6" | "12";

const WINDOW_LABELS: Record<Window, string> = { "3": "3mo", "6": "6mo", "12": "12mo" };

// The interactive leaf: window toggle + hover state for the proportion
// bar/legend/caption. Split out from GenreDietWidget so that component can
// stay a plain server component -- see GenreDietWidget.tsx for why that
// matters.
export function GenreDietBar({
  dietByWindow,
  idleFact,
}: {
  dietByWindow: Record<Window, GenreDiet | null>;
  idleFact: IdleGenreFact | null;
}) {
  const [window, setWindow] = useState<Window>("6");
  const [hovered, setHovered] = useState<string | null>(null);
  const diet = dietByWindow[window];

  const active = diet?.slices.find((s) => s.genre === hovered) ?? null;

  return (
    <>
      <div className="mb-2 flex gap-1">
        {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => {
              setWindow(w);
              setHovered(null);
            }}
            aria-pressed={window === w}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              window === w ? "bg-accent-coral text-on-accent" : "text-ink-warm-faint hover:text-ink-warm"
            }`}
          >
            {WINDOW_LABELS[w]}
          </button>
        ))}
      </div>

      {diet ? (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full" onMouseLeave={() => setHovered(null)}>
            {diet.slices.map((s) => (
              <div
                key={s.genre}
                onMouseEnter={() => setHovered(s.genre)}
                className="cursor-default transition-[filter] duration-150"
                style={{
                  width: `${s.percent}%`,
                  backgroundColor: `var(--accent-${s.accent})`,
                  filter: hovered && hovered !== s.genre ? "brightness(0.6)" : undefined,
                }}
              />
            ))}
          </div>

          <div className="mt-2 flex min-h-[2.5em] flex-wrap gap-x-3 gap-y-1">
            {diet.slices.map((s) => (
              <button
                key={s.genre}
                type="button"
                onMouseEnter={() => setHovered(s.genre)}
                onFocus={() => setHovered(s.genre)}
                className="flex items-center gap-1 text-[11px]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--accent-${s.accent})` }} />
                <span className={s.genre === hovered ? "text-ink-warm" : "text-ink-warm-faint"}>{s.genre}</span>
              </button>
            ))}
          </div>

          <p className="mt-1 text-[11px] text-ink-warm-faint">
            {active
              ? `${active.genre}: ${Math.round(active.percent)}% (${active.count} book${active.count === 1 ? "" : "s"})`
              : diet.diagnosis}
          </p>
        </>
      ) : (
        <p className="text-xs text-ink-warm-faint">Not enough variety in this window.</p>
      )}

      {idleFact && (
        <p className="mt-1 text-[11px] text-ink-warm-faint">
          Idle: {idleFact.days}d since {idleFact.genre}
        </p>
      )}
    </>
  );
}
