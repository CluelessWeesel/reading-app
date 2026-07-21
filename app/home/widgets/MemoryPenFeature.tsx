import Link from "next/link";
import { fraunces } from "../../shared/fonts";
import { formatDateShort } from "../../shared/formatDateShort";
import type { MemoryPen } from "../memoryMath";

// The one deliberately oversized text block on the page -- everything else
// on Home tops out around text-sm; this is the only spot that gets real
// reading-sized serif italic, on purpose, so it reads as a genuine quote
// rather than another stat card.
export function MemoryPenFeature({ memory }: { memory: MemoryPen | null }) {
  if (!memory) return null;

  return (
    <Link
      href={`/books/${memory.bookId}`}
      className="surface-card block h-full rounded-xl p-6 transition duration-180 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-card-lift)] sm:p-8"
    >
      <div className="flex h-full flex-col justify-between gap-6">
        <p className={`${fraunces.className} text-[18px] italic leading-relaxed text-ink-warm sm:text-[19px]`}>
          “{memory.text}”
        </p>
        <div>
          <p className="text-sm font-semibold text-accent-purple">
            {memory.title}
            {memory.author && <span className="font-normal text-ink-warm-faint"> · {memory.author}</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-warm-faint">
            {memory.question ? `In answer to "${memory.question}" · ` : ""}
            {formatDateShort(memory.dateFinished)}
          </p>
        </div>
      </div>
    </Link>
  );
}
