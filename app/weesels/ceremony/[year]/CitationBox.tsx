"use client";

import { useState } from "react";

export function CitationBox({
  initialCitation,
  onSave,
}: {
  initialCitation: string | null;
  onSave: (citation: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialCitation ?? "");
  const [editing, setEditing] = useState(initialCitation == null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-6 text-center">
        {initialCitation ? (
          <p className="text-sm italic text-ink-warm-muted">&ldquo;{initialCitation}&rdquo;</p>
        ) : (
          <p className="text-sm text-ink-warm-faint">No citation yet.</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
        >
          {initialCitation ? "Edit citation" : "Add a citation"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-gold bg-surface-1 p-4 shadow-lg">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Why they won</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        autoFocus
        placeholder="What made this the one..."
        className="w-full rounded-lg border border-gold bg-surface-1 px-3 py-2 text-sm text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
      />
      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-on-accent disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full border border-gold px-3 py-1 text-xs text-ink-warm-muted hover:bg-hover"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
