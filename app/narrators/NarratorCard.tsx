import Link from "next/link";
import { fraunces } from "../shared/fonts";
import { AuthorPhoto } from "../authors/AuthorPhoto";
import type { NarratorSummary } from "./types";

// Reuses AuthorPhoto directly -- it's already generic over name/photoUrl,
// no author-specific logic in it worth duplicating.
export function NarratorCard({ narrator }: { narrator: NarratorSummary }) {
  const vitals = [
    `${narrator.booksCount} book${narrator.booksCount === 1 ? "" : "s"}`,
    narrator.totalPages > 0 ? `${narrator.totalPages.toLocaleString()} pages` : null,
    narrator.avgScore != null ? `${narrator.avgScore.toFixed(2)} avg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/narrators/${narrator.id}`}
      className="surface-card group flex min-w-0 flex-col items-center gap-2 rounded-xl p-3 text-center"
    >
      <AuthorPhoto
        name={narrator.name}
        photoUrl={narrator.photo_url}
        className="aspect-square w-20 sm:w-24"
        initialClassName="text-2xl"
      />
      <div className="flex h-12 w-full min-w-0 flex-col items-center justify-start gap-0.5">
        <p className={`${fraunces.className} line-clamp-2 w-full text-sm font-semibold leading-snug text-ink-warm`}>
          {narrator.name}
        </p>
      </div>
      <p className="w-full min-w-0 truncate text-xs text-ink-warm-faint">{vitals}</p>
    </Link>
  );
}
