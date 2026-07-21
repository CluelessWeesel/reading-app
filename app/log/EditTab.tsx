"use client";

import { useMemo, useState } from "react";
import type { DailyReadingRow } from "./types";

export function EditTab({
  initialRows,
  onPositionUpdated,
}: {
  initialRows: DailyReadingRow[];
  onPositionUpdated: (bookId: number, position: number) => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [saved, setSaved] = useState<Record<number, "cascaded" | "plain">>({});

  // Grouped by date so same-day books line up side by side instead of each
  // getting its own stacked row -- `rows` already arrives date-desc from the
  // server, and Map preserves insertion order, so this doesn't need re-sorting.
  const grouped = useMemo(() => {
    const map = new Map<string, DailyReadingRow[]>();
    for (const row of rows) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  function getDraft(row: DailyReadingRow): string {
    return drafts[row.id] ?? String(row.pages);
  }

  async function handleSave(row: DailyReadingRow) {
    const value = Number(drafts[row.id] ?? row.pages);
    if (Number.isNaN(value) || !Number.isInteger(value) || value < 0) {
      setErrors((prev) => ({ ...prev, [row.id]: "Must be a non-negative whole number." }));
      return;
    }

    setSaving((prev) => ({ ...prev, [row.id]: true }));
    setErrors((prev) => ({ ...prev, [row.id]: null }));
    setSaved((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    try {
      const res = await fetch(`/api/log/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed.");
      }
      const updated = await res.json();
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, pages: value } : r)));
      const cascaded = row.book_id != null && typeof updated.position === "number";
      setSaved((prev) => ({ ...prev, [row.id]: cascaded ? "cascaded" : "plain" }));
      if (cascaded) {
        onPositionUpdated(row.book_id as number, updated.position);
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [row.id]: err instanceof Error ? err.message : "Save failed.",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-warm-faint">
        No daily reading entries in the last 30 days.
      </p>
    );
  }

  return (
    <ul className="surface-flat divide-y divide-gold rounded-xl p-4">
      {grouped.map(([date, dateRows]) => (
        <li key={date} className="py-3 first:pt-0">
          <p className="mb-2 text-sm font-medium text-ink-warm">{date}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {dateRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2">
                <span className="max-w-[140px] truncate text-xs text-ink-warm-faint">
                  {row.book_title ?? "Combined (historical)"}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={getDraft(row)}
                  onChange={(e) => {
                    setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }));
                    setSaved((prev) => {
                      const next = { ...prev };
                      delete next[row.id];
                      return next;
                    });
                  }}
                  className="w-16 rounded-lg border border-gold bg-surface-1 px-2 py-1 text-center text-sm text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  type="button"
                  onClick={() => handleSave(row)}
                  disabled={saving[row.id]}
                  className="shrink-0 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm disabled:opacity-50"
                >
                  {saving[row.id] ? "..." : "Save"}
                </button>
                {saved[row.id] && !errors[row.id] && (
                  <span className="text-xs text-accent">
                    {saved[row.id] === "cascaded" ? "Saved -- current page updated." : "Saved."}
                  </span>
                )}
                {errors[row.id] && (
                  <p className="w-full text-xs text-red-600 dark:text-red-400">{errors[row.id]}</p>
                )}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
