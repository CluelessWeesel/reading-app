import Link from "next/link";
import { fraunces } from "../shared/fonts";
import { AuthorPhoto } from "./AuthorPhoto";
import type { AuthorSummary } from "./types";

export function AuthorCard({ author }: { author: AuthorSummary }) {
  const vitals = [
    `${author.booksCount} book${author.booksCount === 1 ? "" : "s"}`,
    author.totalPages > 0 ? `${author.totalPages.toLocaleString()} pages` : null,
    author.avgScore != null ? `${author.avgScore.toFixed(1)} avg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/authors/${author.id}`}
      className="group flex min-w-0 flex-col items-center gap-2 rounded-xl p-3 text-center transition hover:-translate-y-0.5 hover:bg-hover"
    >
      <AuthorPhoto name={author.name} photoUrl={author.photo_url} className="aspect-square w-20 sm:w-24" initialClassName="text-2xl" />
      {/* Fixed-height text block, same trick as BookCard -- keeps every
          card's footer at the same offset regardless of name length.
          w-full + min-w-0 are load-bearing here: without them, a flex/grid
          child defaults to its content's natural width, so a long name
          would overflow past the card into its neighbour instead of
          wrapping/clipping within it. */}
      <div className="flex h-12 w-full min-w-0 flex-col items-center justify-start gap-0.5">
        <p className={`${fraunces.className} line-clamp-2 w-full text-sm font-semibold leading-snug text-ink`}>{author.name}</p>
      </div>
      <p className="w-full min-w-0 truncate text-xs text-ink-faint">{vitals}</p>
    </Link>
  );
}
