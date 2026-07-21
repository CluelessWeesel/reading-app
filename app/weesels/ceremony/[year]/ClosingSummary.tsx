"use client";

import { useState } from "react";
import Link from "next/link";
import { CoverThumb } from "../../../shared/CoverThumb";
import { AuthorPhoto } from "../../../authors/AuthorPhoto";
import { fraunces } from "../../../shared/fonts";
import type { CeremonyCategoryData } from "./CeremonyView";

export function ClosingSummary({
  year,
  runningCategories,
  onSealed,
}: {
  year: number;
  runningCategories: CeremonyCategoryData[];
  onSealed: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSeal() {
    setSealing(true);
    setError(null);
    try {
      const res = await fetch(`/api/weesels/${year}/seal`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to seal year.");
      }
      onSealed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seal year.");
      setSealing(false);
    }
  }

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-warm-faint">The night&apos;s winners</p>
          <h1 className={`${fraunces.className} mt-1 text-3xl font-semibold text-ink-warm sm:text-4xl`}>{year} Weesels</h1>
        </header>

        {runningCategories.length === 0 ? (
          <p className="rounded-xl border border-gold bg-surface-1 p-6 text-center text-sm text-ink-warm-faint">
            No categories ran this year.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {runningCategories.map((data) => {
              const winner = data.status.state === "revealed" ? data.status.winner : null;
              if (!winner) return null;
              return (
                <div
                  key={data.category.id}
                  className="flex items-center gap-3 rounded-xl border border-gold bg-surface-1 p-3"
                >
                  {winner.bookId != null ? (
                    <CoverThumb title={winner.label} coverUrl={winner.coverUrl} className="aspect-[2/3] w-10" />
                  ) : (
                    <AuthorPhoto
                      name={winner.label}
                      photoUrl={winner.photoUrl}
                      className="aspect-square w-10"
                      initialClassName="text-xs"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-ink-warm-faint">{data.category.name}</p>
                    <p className={`${fraunces.className} truncate text-sm font-semibold text-ink-warm`}>🏆 {winner.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition hover:brightness-95"
            >
              Seal {year}
            </button>
          ) : (
            <div className="max-w-md rounded-xl border border-gold bg-surface-1 p-4 text-center">
              <p className="text-sm text-ink-warm">
                Sealing locks every result for {year}. Changes afterward require a logged amendment. This is
                permanent.
              </p>
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div className="mt-3 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={sealing}
                  className="rounded-full border border-gold px-4 py-1.5 text-xs text-ink-warm-muted hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSeal}
                  disabled={sealing}
                  className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent disabled:opacity-50"
                >
                  {sealing ? "Sealing..." : `Yes, seal ${year}`}
                </button>
              </div>
            </div>
          )}
          <Link
            href="/weesels"
            className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
          >
            ← The Weesels
          </Link>
        </div>
      </div>
    </div>
  );
}
