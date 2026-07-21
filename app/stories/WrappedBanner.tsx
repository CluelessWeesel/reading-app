"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// December-only, gold-on-night counterpart to RecapBanner -- dismissible,
// keyed per year so dismissing this December doesn't hide next December's.
// Same "default dismissed until a mount-time localStorage check" shape as
// RecapBanner/ThemeToggle, for the same reason (no hydration mismatch).
export function WrappedBanner({ year, final }: { year: number; final: boolean }) {
  const storageKey = `wrapped-banner-dismissed-${year}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className="story-theme-night story-card-bg mb-6 flex items-center justify-between gap-4 rounded-xl border border-gold px-4 py-3 text-ink-warm">
      <Link href={`/wrapped/${year}`} className="text-sm font-medium hover:underline">
        Your {year} Wrapped is {final ? "ready" : "taking shape"} →
      </Link>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(storageKey, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="shrink-0 text-ink-warm-faint hover:text-ink-warm"
      >
        ✕
      </button>
    </div>
  );
}
