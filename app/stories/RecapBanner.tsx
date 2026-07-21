"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
}

// Shown on days 1-7 of the month for the recap that just got auto-
// generated (see ensureRecap.ts) -- dismissible, keyed per period so
// dismissing July's banner doesn't hide August's later.
export function RecapBanner({ period }: { period: string }) {
  const storageKey = `recap-banner-dismissed-${period}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className="surface-card mb-6 flex items-center justify-between gap-4 rounded-xl px-4 py-3">
      <Link href={`/recaps/${period}`} className="text-sm font-medium text-ink-warm hover:underline">
        Your {monthLabel(period)} recap is ready →
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
