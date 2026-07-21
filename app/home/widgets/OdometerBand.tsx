"use client";

import { useEffect, useState } from "react";
import { fraunces } from "../../shared/fonts";

// Deliberately simple: no ref-guard, no "already started" bookkeeping --
// just tie the animation directly to whether target is a real, positive
// number yet (it's a server-computed prop, present from the first render,
// so this only ever runs once in practice).
function useCountUp(target: number, durationMs = 1600): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(target);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function OdometerStat({ label, value }: { label: string; value: number }) {
  const shown = useCountUp(value);
  return (
    <div className="text-center">
      <p className={`${fraunces.className} text-4xl font-semibold tabular-nums text-gold-ink sm:text-5xl`}>
        {shown.toLocaleString()}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-[#f3e5ce]/70">{label}</p>
    </div>
  );
}

// Deliberately always the night texture/dark palette, regardless of the
// site's own light/dark theme -- "a ribbon of night on the day page,"
// same fixed-theme idea as the Weesels ceremony overlay. Breaks out of
// the page's centered max-w-5xl column to sit truly full-bleed.
export function OdometerBand({
  totalBooks,
  totalPages,
  totalWords,
}: {
  totalBooks: number;
  totalPages: number;
  totalWords: number;
}) {
  return (
    <div
      className="relative left-1/2 right-1/2 -mx-[50vw] my-12 w-screen px-4 py-12 sm:px-8"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(/textures/night-gold.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-around gap-8">
        <OdometerStat label="Books read" value={totalBooks} />
        <OdometerStat label="Pages turned" value={totalPages} />
        <OdometerStat label="Words read" value={totalWords} />
      </div>
    </div>
  );
}
