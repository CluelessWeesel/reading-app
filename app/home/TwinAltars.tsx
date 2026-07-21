import Link from "next/link";
import { CurrentBookAltar } from "./CurrentBookAltar";
import type { RightNowBook } from "./types";

// The Home hero: up to two "altar" panels for whatever's in current_books
// (already in a neutral, non-format-ranked order -- see getRightNowBooks in
// page.tsx), plus one shared "Log tonight" button beneath both. This is a
// read-only, at-a-glance display -- the full current-books management UI
// (editing position/format, Finish/DNF/Abandon) still lives on
// CurrentlyReadingPanel, used on /library. If more than two books are ever
// in progress at once, only the first two (oldest-started) get an altar
// here; the rest still show on that fuller list.
export function TwinAltars({ books }: { books: RightNowBook[] }) {
  const featured = books.slice(0, 2);

  return (
    <section className="mb-10">
      {featured.length === 0 ? (
        <div className="rounded-2xl border border-gold bg-surface-1 px-6 py-10 text-center">
          <p className="text-sm text-ink-warm-faint">Nothing in progress right now.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${featured.length === 2 ? "sm:grid-cols-2" : ""}`}>
          {featured.map((book) => (
            <CurrentBookAltar key={book.book_id} book={book} />
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Link
          href="/log"
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-on-accent shadow-sm transition hover:brightness-95"
        >
          Log tonight
        </Link>
      </div>
    </section>
  );
}
