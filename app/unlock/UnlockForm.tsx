"use client";

import { useState } from "react";
import { fraunces } from "../shared/fonts";

export function UnlockForm({ next }: { next: string }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Incorrect passcode.");
      }
      window.location.href = next || "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect passcode.");
      setPasscode("");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs text-center">
        <p className={`${fraunces.className} mb-1 text-sm font-semibold text-ink-warm-faint`}>The Weeselry</p>
        <h1 className={`${fraunces.className} mb-6 text-2xl font-semibold text-ink-warm`}>
          Enter passcode
        </h1>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-gold bg-surface-1 px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink-warm shadow-sm outline-none transition focus:ring-2 focus:ring-accent/40"
        />
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !passcode}
          className="mt-6 w-full rounded-full bg-accent px-6 py-3 text-base font-semibold text-on-accent shadow-sm transition disabled:opacity-50"
        >
          {submitting ? "Checking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
