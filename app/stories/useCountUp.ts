"use client";

import { useEffect, useState } from "react";

// Same easing/duration shape as home's OdometerBand, generalized with an
// `animate` flag so a card can force the static final value outright --
// export mode captures a single frozen frame, so animating there would
// either race the capture or just be pointless motion nobody ever sees.
// prefers-reduced-motion is honored independently of that, same as before.
export function useCountUp(target: number, animate: boolean, durationMs = 1600): number {
  const [value, setValue] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate || !Number.isFinite(target) || target <= 0) {
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
  }, [target, animate, durationMs]);

  return value;
}
