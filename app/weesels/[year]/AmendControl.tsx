"use client";

import { useState } from "react";
import type { YearCategoryBlock } from "../types";

// Deliberately tucked away rather than a prominent button -- amending a
// sealed year should read as exceptional, not routine.
export function AmendControl({ year, blocks }: { year: number; blocks: YearCategoryBlock[] }) {
  const ranBlocks = blocks.filter((b) => b.status === "ran" && b.winner);

  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [action, setAction] = useState<"change-winner" | "edit-citation">("change-winner");
  const [newWinnerId, setNewWinnerId] = useState<number | "">("");
  const [newCitation, setNewCitation] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedBlock = ranBlocks.find((b) => b.category.id === categoryId) ?? null;

  function selectCategory(id: number | "") {
    setCategoryId(id);
    setNewWinnerId("");
    const block = ranBlocks.find((b) => b.category.id === id);
    setNewCitation(block?.winner?.citation ?? "");
  }

  async function submit() {
    if (categoryId === "" || !reason.trim()) {
      setError("Pick a category and enter a reason.");
      return;
    }
    if (action === "change-winner" && newWinnerId === "") {
      setError("Pick the new winner.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/weesels/${year}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: categoryId,
          action,
          reason: reason.trim(),
          new_winner_weesel_id: action === "change-winner" ? newWinnerId : undefined,
          new_citation: action === "edit-citation" ? newCitation : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to apply amendment.");
      }
      setDone(true);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply amendment.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        Amend this year
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-hairline bg-card/40 p-4">
      <p className="mb-3 text-sm font-medium text-ink">Amend {year}</p>
      {done ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Amendment applied.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => selectCategory(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-hairline bg-card/70 px-2.5 py-1.5 text-sm text-ink"
            >
              <option value="">Choose a category...</option>
              {ranBlocks.map((b) => (
                <option key={b.category.id} value={b.category.id}>
                  {b.category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction("change-winner")}
              aria-pressed={action === "change-winner"}
              className={`rounded-full border px-3 py-1 text-xs ${
                action === "change-winner" ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-faint"
              }`}
            >
              Change winner
            </button>
            <button
              type="button"
              onClick={() => setAction("edit-citation")}
              aria-pressed={action === "edit-citation"}
              className={`rounded-full border px-3 py-1 text-xs ${
                action === "edit-citation" ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-faint"
              }`}
            >
              Edit citation
            </button>
          </div>

          {selectedBlock && action === "change-winner" && (
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                New winner
              </label>
              <select
                value={newWinnerId}
                onChange={(e) => setNewWinnerId(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-card/70 px-2.5 py-1.5 text-sm text-ink"
              >
                <option value="">Choose a nominee...</option>
                {[selectedBlock.winner, ...selectedBlock.nominees]
                  .filter((n): n is NonNullable<typeof n> => n != null)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.book_title ?? n.nominee}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {selectedBlock && action === "edit-citation" && (
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                New citation
              </label>
              <textarea
                value={newCitation}
                onChange={(e) => setNewCitation(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-hairline bg-card/70 px-3 py-2 text-sm text-ink"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              Reason (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this being amended?"
              className="w-full rounded-lg border border-hairline bg-card/70 px-3 py-2 text-sm text-ink"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-on-accent disabled:opacity-50"
            >
              {saving ? "Applying..." : "Apply amendment"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-hairline px-4 py-1.5 text-xs text-ink-muted hover:bg-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
