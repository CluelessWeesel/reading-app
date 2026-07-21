import Link from "next/link";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import type { Disagreement } from "./scoreVsTierMath";

function tierLabel(tier: Disagreement["tier"]): string {
  return tier === "holding" ? "Holding" : tier;
}

// The most interesting thing the two systems produce together -- not a
// ranking of its own, just the gap between "how good was it?" and "what
// does it mean to me now?" for whichever books disagree the most.
export function ScoreVsTierPanel({ disagreements }: { disagreements: Disagreement[] }) {
  const top = disagreements.slice(0, 10);
  if (top.length === 0) return null;

  return (
    <div className="rounded-xl border border-gold bg-surface-1 p-4">
      <h2 className={`${fraunces.className} mb-1 text-sm font-semibold text-ink-warm`}>Score vs tier</h2>
      <p className="mb-3 text-xs text-ink-warm-faint">Where the score and the tier disagree the most.</p>
      <div className="divide-y divide-gold">
        {top.map((d) => (
          <div key={d.book_id} className="flex items-center gap-2.5 py-1.5">
            <CoverThumb title={d.title} coverUrl={d.cover_url} className="aspect-[2/3] w-7 shrink-0" />
            <Link href={`/books/${d.book_id}`} className="min-w-0 flex-1 truncate text-sm text-ink-warm hover:underline">
              {d.title}
            </Link>
            <span className="shrink-0 text-xs text-ink-warm-faint">{d.score.toFixed(2)} · {tierLabel(d.tier)}</span>
            <span
              className={`shrink-0 text-xs font-medium ${
                d.disagreement > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {d.disagreement > 0 ? "score > tier" : "tier > score"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
