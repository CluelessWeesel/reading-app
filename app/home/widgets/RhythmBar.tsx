"use client";

import { useState } from "react";
import { formatDateShort } from "../../shared/formatDateShort";
import type { RhythmNight } from "../rhythmMath";

// The one genuinely interactive leaf in the ribbon -- just this bar's own
// hover state, tooltip positioned relative to itself (centered above, via
// plain CSS) rather than tracked mouse coordinates against a shared
// container ref. Isolating "use client" to this single small leaf instead
// of the whole RhythmRibbon card keeps the client/server boundary as deep
// as possible, which is the React/Next-recommended default anyway.
export function RhythmBar({ night, heightPercent }: { night: RhythmNight; heightPercent: number }) {
  const [hovering, setHovering] = useState(false);

  return (
    <div className="relative flex flex-1 flex-col items-center gap-1">
      <div className="flex h-16 w-full items-end">
        <div
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`w-full cursor-default rounded-t-sm transition-[height] duration-300 ${
            night.isToday ? "border border-accent-blue" : ""
          }`}
          style={{
            height: `${heightPercent}%`,
            backgroundColor: night.pages === 0 ? "var(--border-gold)" : "var(--accent-blue)",
            opacity: night.pages === 0 ? 1 : night.isBest ? 1 : 0.45,
            boxShadow: night.isBest ? "0 0 10px var(--accent-blue)" : undefined,
          }}
        />
      </div>

      {hovering && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg border border-gold bg-surface-1 px-2.5 py-1.5 text-xs shadow-lg">
          <p className="font-semibold text-ink-warm">{night.pages} pages</p>
          <p className="text-ink-warm-faint">{formatDateShort(night.date)}</p>
        </div>
      )}
    </div>
  );
}
