"use client";

import { useState } from "react";
import { fraunces } from "./fonts";
import { fieldClass, modalLabelClass } from "./formControls";

// Interposed in front of a rank/score edit whenever classifyYearEdit says
// the target year isn't just "the year currently being read" -- either the
// sanctioned adjustment path (a reason, logged and capped server-side) or a
// plain "are you sure?" for touching an already-finalized year outside its
// window. onConfirm does the real fetch and is expected to throw with a
// user-facing message on failure (e.g. the server's 403 budget-exceeded or
// 409 needs-confirmation replies) -- this modal surfaces that inline
// instead of closing, so the reason/confirmation isn't lost on a retry.
export function EditGuardModal({
  mode,
  title,
  description,
  year,
  onConfirm,
  onCancel,
}: {
  mode: "adjustment" | "historical";
  title: string;
  description: string;
  year: number;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (mode === "adjustment" && !reason.trim()) {
      setError("A short reason is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(mode === "adjustment" ? reason.trim() : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-gold bg-surface-3 p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <h2 className={`${fraunces.className} mb-1 text-lg font-semibold text-ink-warm`}>{title}</h2>
        <p className="mb-3 text-sm text-ink-warm-faint">{description}</p>

        {mode === "adjustment" ? (
          <>
            <p className="mb-3 text-xs text-ink-warm-faint">
              This counts as one of your end-of-year adjustments for {year}.
            </p>
            <label className={modalLabelClass()} htmlFor="adjustment-reason">Reason</label>
            <input
              id="adjustment-reason"
              className={fieldClass()}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="One line -- why this change"
              autoFocus
            />
          </>
        ) : (
          <p className="mb-3 text-xs text-ink-warm-faint">
            {year} is outside its adjustment window. This is an unusual edit -- it won&apos;t be tracked as an
            official adjustment, but it will still change the historical record.
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-gold px-4 py-1.5 text-sm text-ink-warm-muted hover:text-ink-warm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent transition disabled:opacity-50"
          >
            {saving ? "Saving..." : mode === "adjustment" ? "Log adjustment" : "Edit anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
