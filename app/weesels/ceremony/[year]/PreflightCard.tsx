"use client";

import { useMemo, useState } from "react";
import { CoverThumb } from "../../../shared/CoverThumb";
import { AuthorPhoto } from "../../../authors/AuthorPhoto";
import { fraunces } from "../../../shared/fonts";
import { MAX_NOMINEES } from "../constants";
import type { WeeselCategory } from "../../types";
import type { AuthorOption, EligibleCandidate, WatchedSuggestion, YearFinishedBook } from "../types";

const AUTHOR_IDENTITY_CATEGORIES = new Set(["Author of the Year", "Best New Author"]);

function candidateRowKey(c: EligibleCandidate): string {
  return c.key;
}

function CandidateRow({ candidate, onRemove }: { candidate: EligibleCandidate; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-hairline bg-card/70 px-2 py-1.5 text-sm">
      {candidate.bookId != null ? (
        <CoverThumb title={candidate.label} coverUrl={candidate.coverUrl} className="aspect-[2/3] w-6" />
      ) : candidate.authorId != null || candidate.photoUrl != null ? (
        <AuthorPhoto name={candidate.label} photoUrl={candidate.photoUrl} className="aspect-square w-6" initialClassName="text-[8px]" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">
          {candidate.preStarred && <span title="Flagged in the finish ceremony">⭐ </span>}
          {candidate.label}
        </p>
        {candidate.sublabel && <p className="truncate text-xs text-ink-faint">{candidate.sublabel}</p>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full px-2 text-xs text-ink-faint hover:text-red-600 dark:hover:text-red-400"
        aria-label={`Remove ${candidate.label}`}
      >
        ✕
      </button>
    </li>
  );
}

function ShortlistRow({
  candidate,
  selected,
  disabled,
  onToggle,
}: {
  candidate: EligibleCandidate;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition ${
        selected
          ? "border-accent bg-accent/10"
          : disabled
            ? "border-hairline bg-card/30 opacity-40"
            : "border-hairline bg-card/70 hover:bg-hover"
      }`}
    >
      {candidate.bookId != null ? (
        <CoverThumb title={candidate.label} coverUrl={candidate.coverUrl} className="aspect-[2/3] w-6" />
      ) : candidate.authorId != null || candidate.photoUrl != null ? (
        <AuthorPhoto name={candidate.label} photoUrl={candidate.photoUrl} className="aspect-square w-6" initialClassName="text-[8px]" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">{candidate.label}</p>
        {candidate.sublabel && <p className="truncate text-xs text-ink-faint">{candidate.sublabel}</p>}
      </div>
      <span className={`shrink-0 text-xs ${selected ? "text-accent" : "text-ink-faint"}`}>{selected ? "✓ kept" : "tap to keep"}</span>
    </button>
  );
}

export function PreflightCard({
  year,
  category,
  computedPool,
  watchedSuggestions,
  isManualPick,
  yearBooks,
  allAuthors,
  onConfirmed,
}: {
  year: number;
  category: WeeselCategory;
  computedPool: EligibleCandidate[];
  watchedSuggestions: WatchedSuggestion[];
  isManualPick: boolean;
  yearBooks: YearFinishedBook[];
  allAuthors: AuthorOption[];
  onConfirmed: () => void;
}) {
  const [pool, setPool] = useState<EligibleCandidate[]>(computedPool);
  const [addText, setAddText] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualSublabel, setManualSublabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"building" | "shortlisting">("building");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const isAuthorIdentity = AUTHOR_IDENTITY_CATEGORIES.has(category.name);

  const availableOptions = useMemo(() => {
    const inPool = new Set(pool.map((c) => c.key));
    if (isManualPick) return [];
    if (isAuthorIdentity) {
      return allAuthors
        .filter((a) => !inPool.has(`author-${a.author_id}`))
        .map((a) => ({ key: `author-${a.author_id}`, label: a.name, sublabel: null, bookId: null, authorId: a.author_id, coverUrl: null, photoUrl: a.photo_url }) as EligibleCandidate);
    }
    return yearBooks
      .filter((b) => !inPool.has(`book-${b.book_id}`))
      .map((b) => ({ key: `book-${b.book_id}`, label: b.title, sublabel: b.author, bookId: b.book_id, authorId: b.author_id, coverUrl: b.cover_url, photoUrl: null }) as EligibleCandidate);
  }, [pool, isManualPick, isAuthorIdentity, allAuthors, yearBooks]);

  const datalistId = `preflight-options-${category.id}`;

  function addFromSearch() {
    const match = availableOptions.find((o) => o.label.toLowerCase() === addText.trim().toLowerCase());
    if (!match) {
      setError("No match in the list -- pick an exact suggestion.");
      return;
    }
    setPool((prev) => [...prev, match]);
    setAddText("");
    setError(null);
  }

  function addManual() {
    if (!manualLabel.trim()) {
      setError("Enter a name first.");
      return;
    }
    const authorMatch = allAuthors.find((a) => a.name.toLowerCase() === manualSublabel.trim().toLowerCase());
    const candidate: EligibleCandidate = {
      key: `manual-${Date.now()}-${Math.random()}`,
      label: manualLabel.trim(),
      sublabel: manualSublabel.trim() || null,
      bookId: null,
      authorId: authorMatch?.author_id ?? null,
      coverUrl: null,
      photoUrl: authorMatch?.photo_url ?? null,
    };
    setPool((prev) => [...prev, candidate]);
    setManualLabel("");
    setManualSublabel("");
    setError(null);
  }

  function removeCandidate(key: string) {
    setPool((prev) => prev.filter((c) => c.key !== key));
  }

  const remainingSuggestions = watchedSuggestions.filter((w) => !pool.some((c) => c.bookId === w.bookId));

  function addSuggestion(w: WatchedSuggestion) {
    setPool((prev) => [
      ...prev,
      {
        key: `book-${w.bookId}`,
        label: w.title,
        sublabel: w.author,
        bookId: w.bookId,
        authorId: null,
        coverUrl: w.coverUrl,
        photoUrl: null,
        preStarred: true,
      },
    ]);
  }

  async function confirm(candidatesToSubmit: EligibleCandidate[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/weesels/ceremony/${year}/confirm-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: category.id,
          candidates: candidatesToSubmit.map((c) => ({ label: c.label, sublabel: c.sublabel, book_id: c.bookId })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to confirm category.");
      }
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm category.");
    } finally {
      setSaving(false);
    }
  }

  function startShortlisting() {
    setSelectedKeys(new Set());
    setError(null);
    setPhase("shortlisting");
  }

  function toggleSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_NOMINEES) {
        next.add(key);
      }
      return next;
    });
  }

  const verdict = pool.length >= category.min_candidates ? "runs" : "does-not-run";

  if (phase === "shortlisting") {
    const selectedCandidates = pool.filter((c) => selectedKeys.has(c.key));
    return (
      <div className="rounded-xl border border-hairline bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className={`${fraunces.className} text-base font-semibold text-ink`}>{category.name}</h3>
            <p className="text-xs text-ink-faint">Cut down to {MAX_NOMINEES} for the ballot</p>
          </div>
          <span className="shrink-0 rounded-full bg-hairline px-2.5 py-1 text-xs font-medium text-ink-faint">
            {selectedKeys.size}/{MAX_NOMINEES} selected
          </span>
        </div>

        <ul className="mb-3 space-y-1.5">
          {pool.map((c) => (
            <li key={c.key}>
              <ShortlistRow
                candidate={c}
                selected={selectedKeys.has(c.key)}
                disabled={!selectedKeys.has(c.key) && selectedKeys.size >= MAX_NOMINEES}
                onToggle={() => toggleSelected(c.key)}
              />
            </li>
          ))}
        </ul>

        {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPhase("building")}
            className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            ← Back to pool
          </button>
          <button
            type="button"
            onClick={() => confirm(selectedCandidates)}
            disabled={saving || selectedKeys.size !== MAX_NOMINEES}
            className="ml-auto rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent shadow-sm transition hover:brightness-95 disabled:opacity-50"
          >
            {saving ? "Confirming..." : "Confirm shortlist"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className={`${fraunces.className} text-base font-semibold text-ink`}>{category.name}</h3>
          <p className="text-xs text-ink-faint">
            {pool.length} candidate{pool.length === 1 ? "" : "s"} · needs {category.min_candidates}+
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            verdict === "runs" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-hairline text-ink-faint"
          }`}
        >
          {verdict === "runs" ? "RUNS" : "DOES NOT RUN"}
        </span>
      </div>

      {pool.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {pool.map((c) => (
            <CandidateRow key={candidateRowKey(c)} candidate={c} onRemove={() => removeCandidate(c.key)} />
          ))}
        </ul>
      )}

      {remainingSuggestions.length > 0 && (
        <div className="mb-3 rounded-lg border border-dashed border-accent/40 bg-accent/5 p-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
            ⭐ From your watchlist
          </p>
          <div className="flex flex-wrap gap-1.5">
            {remainingSuggestions.map((w) => (
              <button
                key={w.bookId}
                type="button"
                onClick={() => addSuggestion(w)}
                className="rounded-full border border-hairline bg-card/70 px-2.5 py-1 text-xs text-ink hover:bg-hover"
              >
                + {w.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {isManualPick ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
            placeholder={category.name === "Best Series" ? "Series name" : "Author name"}
            list={`preflight-authors-${category.id}`}
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-card/70 px-2.5 py-1.5 text-sm text-ink"
          />
          {category.name === "Best Series" && (
            <input
              type="text"
              value={manualSublabel}
              onChange={(e) => setManualSublabel(e.target.value)}
              placeholder="Author"
              list={`preflight-authors-${category.id}`}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-card/70 px-2.5 py-1.5 text-sm text-ink"
            />
          )}
          <datalist id={`preflight-authors-${category.id}`}>
            {allAuthors.map((a) => (
              <option key={a.author_id} value={a.name} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={addManual}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-muted hover:bg-hover"
          >
            Add
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder={isAuthorIdentity ? "Add an author..." : "Add a book..."}
            list={datalistId}
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-card/70 px-2.5 py-1.5 text-sm text-ink"
          />
          <datalist id={datalistId}>
            {availableOptions.map((o) => (
              <option key={o.key} value={o.label} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={addFromSearch}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-muted hover:bg-hover"
          >
            Add
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {pool.length > MAX_NOMINEES ? (
        <button
          type="button"
          onClick={startShortlisting}
          className="mt-3 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent shadow-sm transition hover:brightness-95"
        >
          Cut down to {MAX_NOMINEES} →
        </button>
      ) : (
        <button
          type="button"
          onClick={() => confirm(pool)}
          disabled={saving}
          className="mt-3 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent shadow-sm transition hover:brightness-95 disabled:opacity-50"
        >
          {saving ? "Confirming..." : "Confirm"}
        </button>
      )}
    </div>
  );
}
