import Link from "next/link";
import type { ReactNode } from "react";
import type { Minis } from "./derivedStats";

function MiniCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
      {children}
    </div>
  );
}

function BookLink({ bookId, title }: { bookId: number; title: string }) {
  return (
    <Link href={`/books/${bookId}`} className="block truncate text-sm text-ink-warm hover:underline">
      {title}
    </Link>
  );
}

// Each mini renders only when its underlying data exists -- a sparse author
// just ends up with fewer cards, never a broken or fabricated one.
export function MinisRow({ minis }: { minis: Minis }) {
  const cards: ReactNode[] = [];

  if (minis.longestBook) {
    cards.push(
      <MiniCard key="longest" label="Their longest, that I've read">
        <BookLink bookId={minis.longestBook.book_id} title={minis.longestBook.title} />
        <p className="text-xs text-ink-warm-faint">{Math.round(minis.longestBook.word_count as number).toLocaleString()} words</p>
      </MiniCard>
    );
  }

  if (minis.fastestRead) {
    cards.push(
      <MiniCard key="fastest" label="My fastest read of theirs">
        <BookLink bookId={minis.fastestRead.book_id} title={minis.fastestRead.title} />
        <p className="text-xs text-ink-warm-faint">{(minis.fastestRead.avg_pages_per_day as number).toFixed(1)} pg/day</p>
      </MiniCard>
    );
  }

  if (minis.peakRanked) {
    cards.push(
      <MiniCard key="peak" label="Their peak-ranked book, ever">
        <BookLink bookId={minis.peakRanked.book.book_id} title={minis.peakRanked.book.title} />
        <p className="text-xs text-ink-warm-faint">
          #{minis.peakRanked.info.rank} of {minis.peakRanked.info.total} · {minis.peakRanked.info.year}
        </p>
      </MiniCard>
    );
  }

  if (minis.totalDaysInWords != null) {
    cards.push(
      <MiniCard key="days-in-words" label="Days of your life in their words">
        <p className="text-sm text-ink-warm">{minis.totalDaysInWords} days</p>
      </MiniCard>
    );
  }

  if (minis.daysSinceLast) {
    cards.push(
      <MiniCard key="days-since" label="Time since your last read">
        <p className="text-sm text-ink-warm">
          {minis.daysSinceLast.days} day{minis.daysSinceLast.days === 1 ? "" : "s"} since your last {minis.daysSinceLast.surname}
        </p>
      </MiniCard>
    );
  }

  if (cards.length === 0) return null;

  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{cards}</div>;
}
