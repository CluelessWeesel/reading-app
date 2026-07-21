import Link from "next/link";
import { fraunces } from "../shared/fonts";
import type { AdjustmentWindowData } from "./types";

function formatVal(kind: "rank" | "score", v: number | null): string {
  if (v == null) return "unranked";
  return kind === "rank" ? `#${v}` : v.toFixed(1);
}

function formatTimestamp(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  return `${datePart} ${timePart?.slice(0, 5) ?? ""}`.trim();
}

export function AdjustmentWindowPanel({ data }: { data: AdjustmentWindowData }) {
  const { year, isOpen, usedCount, limit, events } = data;

  return (
    <div className="mb-4 rounded-xl border border-gold bg-surface-1 p-4">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className={`${fraunces.className} text-sm font-semibold text-ink-warm`}>
          Adjustment window · {year}
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            isOpen ? "border-accent bg-accent/10 text-ink-warm" : "border-gold text-ink-warm-faint"
          }`}
        >
          {isOpen ? `${usedCount} of ${limit} changes used` : `${usedCount} of ${limit} used · closed`}
        </span>
      </div>

      {!isOpen && (
        <p className="mb-2 text-xs text-ink-warm-faint">
          This window has closed. Shown here read-only -- drag a row or edit a score on this year outside the
          window and you&apos;ll be asked to confirm it&apos;s an unusual, untracked edit.
        </p>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-ink-warm-faint">No adjustments logged for {year} yet.</p>
      ) : (
        <ul className="divide-y divide-gold">
          {events.map((e, i) => (
            <li key={`${e.kind}-${e.book_id}-${e.changed_at}-${i}`} className="py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <Link href={`/books/${e.book_id}`} className="font-medium text-ink-warm hover:underline">
                  {e.title}
                </Link>
                <span className="text-xs text-ink-warm-faint">{formatTimestamp(e.changed_at)}</span>
              </div>
              <p className="text-xs text-ink-warm-faint">
                {e.kind === "rank" ? "Rank" : "Score"}: {formatVal(e.kind, e.old_val)} → {formatVal(e.kind, e.new_val)}
                {" · "}
                <span className="italic">{e.reason}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
