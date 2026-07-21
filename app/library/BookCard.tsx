import Link from "next/link";
import { Cover } from "../shared/Cover";
import { fraunces } from "../shared/fonts";
import { StarRating } from "./StarRating";
import type { Book } from "../shared/bookTypes";

export function BookCard({
  book,
  onCoverChange,
  onEditRequest,
  sortValueLabel,
}: {
  book: Book;
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
  onEditRequest: (bookId: number) => void;
  sortValueLabel?: string | null;
}) {
  return (
    <div className="frame-book-card group flex flex-col gap-2">
      <Link href={`/books/${book.book_id}`} className="mt-[18px] block">
        <Cover
          id={book.book_id}
          title={book.title}
          coverUrl={book.cover_url}
          onCoverChange={onCoverChange}
          apiPath={`/api/books/${book.book_id}/cover`}
          roundedClassName="rounded-xl"
          className="aspect-[2/3] w-full"
        />
      </Link>

      {/* Fixed total height (not a per-line min-height guess) with the
          footer pinned to the bottom via mt-auto -- guarantees every card's
          footer lands at the same pixel offset regardless of title length,
          font-rounding, or whether a book has a series/sort label. */}
      <div className="flex h-32 flex-col gap-0.5 px-0.5">
        <h2 className={`${fraunces.className} line-clamp-2 text-base font-semibold leading-snug text-ink-warm`}>
          <Link href={`/books/${book.book_id}`} className="hover:underline">
            {book.title}
          </Link>
        </h2>
        <p className="truncate text-sm text-ink-warm-muted">
          {book.author_id != null ? (
            <Link href={`/authors/${book.author_id}`} className="hover:underline">
              {book.author}
            </Link>
          ) : (
            book.author
          )}
        </p>
        <p className={`truncate text-xs italic text-ink-warm-faint ${book.series ? "" : "invisible"}`}>
          {book.series ?? " "}
          {book.series && book.series_number != null ? ` #${book.series_number}` : ""}
        </p>

        <div className="mt-auto flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-xs text-ink-warm-faint">
            <span>{book.year_read}</span>
            <StarRating score={book.score} />
          </div>
          {sortValueLabel && (
            <p className="truncate text-xs text-ink-warm-faint">{sortValueLabel}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEditRequest(book.book_id)}
        className="self-center px-0.5 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 opacity-0 transition-opacity duration-150 hover:text-ink-warm group-hover:opacity-100"
      >
        Edit
      </button>
    </div>
  );
}
