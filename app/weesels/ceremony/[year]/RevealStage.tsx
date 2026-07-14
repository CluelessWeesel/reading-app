"use client";

import { useState } from "react";
import Link from "next/link";
import { CoverThumb } from "../../../shared/CoverThumb";
import { AuthorPhoto } from "../../../authors/AuthorPhoto";
import { fraunces } from "../../../shared/fonts";
import { Confetti } from "./Confetti";
import { CitationBox } from "./CitationBox";
import type { CeremonyCategoryData } from "./CeremonyView";
import type { ConfirmedNominee } from "../types";

function NomineeTile({
  nominee,
  selected,
  dimmed,
  onClick,
}: {
  nominee: ConfirmedNominee;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl p-3 transition ${
        selected ? "bg-accent/15 ring-2 ring-accent" : dimmed ? "opacity-40" : "hover:bg-white/5"
      }`}
    >
      {nominee.bookId != null ? (
        <CoverThumb title={nominee.label} coverUrl={nominee.coverUrl} className="aspect-[2/3] w-20 sm:w-24" />
      ) : (
        <AuthorPhoto
          name={nominee.label}
          photoUrl={nominee.photoUrl}
          className="aspect-square w-20 sm:w-24"
          initialClassName="text-xl"
        />
      )}
      <p className="mt-2 max-w-[7rem] truncate text-center text-sm font-medium">{nominee.label}</p>
      {nominee.sublabel && <p className="max-w-[7rem] truncate text-center text-xs text-white/50">{nominee.sublabel}</p>}
    </button>
  );
}

export function RevealStage({
  year,
  data,
  progress,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onChanged,
}: {
  year: number;
  data: CeremonyCategoryData;
  progress: { revealed: number; total: number };
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onChanged: () => void;
}) {
  const { category, status } = data;
  const nominees = status.state === "confirmed-running" || status.state === "revealed" ? status.nominees : [];
  const alreadyWinner = status.state === "revealed" ? status.winner : null;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [localWinner, setLocalWinner] = useState<ConfirmedNominee | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const winner = localWinner ?? alreadyWinner;
  const displayedRevealedCount = progress.revealed + (localWinner && status.state !== "revealed" ? 1 : 0);

  async function handleReveal() {
    if (selectedId == null) return;
    setRevealing(true);
    setError(null);
    try {
      const res = await fetch(`/api/weesels/ceremony/${year}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: category.id, winner_weesel_id: selectedId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reveal winner.");
      }
      const picked = nominees.find((n) => n.weeselId === selectedId) ?? null;
      setLocalWinner(picked);
      setConfettiTrigger((v) => v + 1);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal winner.");
    } finally {
      setRevealing(false);
    }
  }

  async function handleSaveCitation(citation: string) {
    const res = await fetch(`/api/weesels/ceremony/${year}/citation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: category.id, citation: citation || null }),
    });
    if (!res.ok) throw new Error("Failed to save citation.");
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#14100b] text-[#f0e6d6]">
      <Confetti trigger={confettiTrigger} />

      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/weesels"
          className="text-xs text-white/50 underline decoration-dotted underline-offset-4 hover:text-white/80"
        >
          Exit ceremony
        </Link>
        <p className="text-xs text-white/50">
          {displayedRevealedCount} of {progress.total} awarded
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">{year} Weesels</p>
        <h1 className={`${fraunces.className} mt-2 text-center text-3xl font-semibold sm:text-4xl`}>{category.name}</h1>

        {!winner ? (
          <>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {nominees.map((n) => (
                <NomineeTile
                  key={n.weeselId}
                  nominee={n}
                  selected={selectedId === n.weeselId}
                  dimmed={selectedId != null && selectedId !== n.weeselId}
                  onClick={() => setSelectedId(n.weeselId)}
                />
              ))}
            </div>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleReveal}
              disabled={selectedId == null || revealing}
              className="mt-8 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-on-accent shadow-lg transition hover:brightness-95 disabled:opacity-40"
            >
              {revealing ? "Revealing..." : "Reveal the winner"}
            </button>
          </>
        ) : (
          <div className="animate-winner-reveal flex flex-col items-center">
            <span className="animate-crown-drop text-4xl">🏆</span>
            <div className="mt-3">
              {winner.bookId != null ? (
                <CoverThumb title={winner.label} coverUrl={winner.coverUrl} className="aspect-[2/3] w-32 shadow-2xl sm:w-40" />
              ) : (
                <AuthorPhoto
                  name={winner.label}
                  photoUrl={winner.photoUrl}
                  className="aspect-square w-32 shadow-2xl sm:w-40"
                  initialClassName="text-4xl"
                />
              )}
            </div>
            <p className={`${fraunces.className} mt-4 text-center text-2xl font-semibold`}>{winner.label}</p>
            {winner.sublabel && <p className="text-center text-sm text-white/60">{winner.sublabel}</p>}

            <div className="w-full max-w-md">
              <CitationBox
                key={category.id}
                initialCitation={status.state === "revealed" ? status.citation : null}
                onSave={handleSaveCitation}
              />
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            className="text-xs text-white/50 underline decoration-dotted underline-offset-4 hover:text-white/80 disabled:opacity-30"
          >
            ← Back
          </button>
          {winner && (
            <button
              type="button"
              onClick={onForward}
              disabled={!canGoForward}
              className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              Next category →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
