import { Cover } from "./Cover";
import { fraunces } from "./fonts";
import { StarRating } from "./StarRating";
import type { Book } from "./types";

export function BookCard({
  book,
  onCoverChange,
  sortValueLabel,
}: {
  book: Book;
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
  sortValueLabel?: string | null;
}) {
  return (
    <div className="group flex flex-col gap-2 rounded-xl p-2 transition hover:-translate-y-0.5 hover:bg-hover">
      <Cover book={book} onCoverChange={onCoverChange} />

      {/* Fixed total height (not a per-line min-height guess) with the
          footer pinned to the bottom via mt-auto -- guarantees every card's
          footer lands at the same pixel offset regardless of title length,
          font-rounding, or whether a book has a series/sort label. */}
      <div className="flex h-32 flex-col gap-0.5 px-0.5">
        <h2 className={`${fraunces.className} line-clamp-2 text-base font-semibold leading-snug text-ink`}>
          {book.title}
        </h2>
        <p className="truncate text-sm text-ink-muted">{book.author}</p>
        <p className={`truncate text-xs italic text-ink-faint ${book.series ? "" : "invisible"}`}>
          {book.series ?? " "}
          {book.series && book.series_number != null ? ` #${book.series_number}` : ""}
        </p>

        <div className="mt-auto flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span>{book.year_read}</span>
            <StarRating score={book.score} />
          </div>
          {sortValueLabel && (
            <p className="truncate text-xs text-ink-faint">{sortValueLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
