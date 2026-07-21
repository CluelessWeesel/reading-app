import Link from "next/link";
import { AuthorPhoto } from "../../authors/AuthorPhoto";
import { CoverThumb } from "../../shared/CoverThumb";
import { fraunces } from "../../shared/fonts";
import {
  creditedAuthorId,
  creditedAuthorName,
  creditedNarratorId,
  displayTitle,
  isAuthorIdentityCategory,
} from "../weeselMath";
import type { YearCategoryBlock } from "../types";

// The circular photo, same visual as the person's own page -- used both as
// a category's primary line (Author of the Year, where the nominee *is*
// the author) and as the "by so-and-so"/"narrated by" sub-line under a
// book/series entry. Best Narration rows carry a narratorId instead of an
// authorId (see weeselMath.ts's creditedNarratorId) -- checked first so
// those link to /narrators instead of staying unlinked.
function AuthorLink({
  name,
  authorId,
  narratorId,
  photos,
  narratorPhotos,
  size = "sm",
}: {
  name: string;
  authorId: number | null;
  narratorId: number | null;
  photos: Record<number, string | null>;
  narratorPhotos: Record<number, string | null>;
  size?: "sm" | "lg";
}) {
  const photoClass = size === "lg" ? "aspect-square w-8" : "aspect-square w-5";
  const textClass = size === "lg" ? `${fraunces.className} text-lg font-semibold text-ink-warm` : "truncate text-xs text-ink-warm-faint";
  const href = narratorId != null ? `/narrators/${narratorId}` : authorId != null ? `/authors/${authorId}` : null;
  const photoUrl = narratorId != null ? (narratorPhotos[narratorId] ?? null) : authorId != null ? (photos[authorId] ?? null) : null;
  if (href == null) {
    return <p className={textClass}>{name}</p>;
  }
  return (
    <Link href={href} className={`inline-flex min-w-0 items-center gap-2 hover:underline ${textClass}`}>
      <AuthorPhoto name={name} photoUrl={photoUrl} className={`${photoClass} shrink-0`} initialClassName="text-[9px]" />
      <span className="truncate">{name}</span>
    </Link>
  );
}

function NomineeRow({
  row,
  categoryName,
  photos,
  narratorPhotos,
}: {
  row: YearCategoryBlock["nominees"][number];
  categoryName: string;
  photos: Record<number, string | null>;
  narratorPhotos: Record<number, string | null>;
}) {
  const title = displayTitle(row);
  const authorName = creditedAuthorName(row, categoryName);
  const authorId = creditedAuthorId(row, categoryName);
  const narratorId = creditedNarratorId(row, categoryName);

  if (isAuthorIdentityCategory(categoryName)) {
    return (
      <AuthorLink
        name={authorName ?? title}
        authorId={authorId}
        narratorId={narratorId}
        photos={photos}
        narratorPhotos={narratorPhotos}
      />
    );
  }

  // Title and author are separate links (like the Winner block above),
  // never one nested inside the other -- an <a> wrapping the whole row
  // used to also contain AuthorLink's own <a>, which is invalid HTML and
  // broke hydration ("<a> cannot be a descendant of <a>").
  return (
    <div className="flex items-center gap-3">
      {row.book_id != null && <CoverThumb title={title} coverUrl={row.cover_url} className="aspect-[2/3] w-9" />}
      <div className="min-w-0">
        {row.book_id != null ? (
          <Link href={`/books/${row.book_id}`} className="block truncate text-sm text-ink-warm hover:underline">
            {title}
          </Link>
        ) : (
          <p className="truncate text-sm text-ink-warm">{title}</p>
        )}
        {authorName && (
          <div className="mt-1">
            <AuthorLink
              name={authorName}
              authorId={authorId}
              narratorId={narratorId}
              photos={photos}
              narratorPhotos={narratorPhotos}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function CategoryBlock({
  block,
  photos,
  narratorPhotos,
  year,
}: {
  block: YearCategoryBlock;
  photos: Record<number, string | null>;
  narratorPhotos: Record<number, string | null>;
  year: number;
}) {
  const { category, status, winner, nominees } = block;

  if (status === "not-yet-existing") return null;

  if (status === "did-not-run") {
    return (
      <details className="rounded-lg border border-gold bg-surface-1 px-3 py-2">
        <summary className="cursor-pointer text-sm text-ink-warm-faint">{category.name}</summary>
        <p className="mt-1 text-xs text-ink-warm-faint">Did not run — insufficient candidates.</p>
      </details>
    );
  }

  const authorIdentity = isAuthorIdentityCategory(category.name);
  const winnerTitle = winner ? displayTitle(winner) : null;
  const winnerAuthorName = winner ? creditedAuthorName(winner, category.name) : null;
  const winnerAuthorId = winner ? creditedAuthorId(winner, category.name) : null;
  const winnerNarratorId = winner ? creditedNarratorId(winner, category.name) : null;

  return (
    <div className="rounded-xl border border-gold bg-surface-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>{category.name}</h3>
        {winner && (
          <a
            href={`/api/weesels/${year}/share/${category.id}`}
            download
            className="shrink-0 text-[10px] text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
          >
            Share
          </a>
        )}
      </div>

      {winner ? (
        <div className="flex items-center gap-4">
          {!authorIdentity && winner.book_id != null && (
            <CoverThumb
              title={winnerTitle as string}
              coverUrl={winner.cover_url}
              className="aspect-[2/3] w-16 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-ink-warm-faint">🏆 Winner</p>
            {authorIdentity ? (
              <AuthorLink
                name={winnerAuthorName ?? (winnerTitle as string)}
                authorId={winnerAuthorId}
                narratorId={winnerNarratorId}
                photos={photos}
                narratorPhotos={narratorPhotos}
                size="lg"
              />
            ) : winner.book_id != null ? (
              <Link
                href={`/books/${winner.book_id}`}
                className={`${fraunces.className} block truncate text-lg font-semibold text-ink-warm hover:underline`}
              >
                {winnerTitle}
              </Link>
            ) : (
              <p className={`${fraunces.className} truncate text-lg font-semibold text-ink-warm`}>{winnerTitle}</p>
            )}
            {!authorIdentity && winnerAuthorName && (
              <AuthorLink
                name={winnerAuthorName}
                authorId={winnerAuthorId}
                narratorId={winnerNarratorId}
                photos={photos}
                narratorPhotos={narratorPhotos}
              />
            )}
            {winner.citation ? (
              <p className="mt-1 text-sm italic text-ink-warm-muted">&ldquo;{winner.citation}&rdquo;</p>
            ) : (
              <p className="mt-1 text-xs text-ink-warm-faint">No citation yet — add one to remember why this won.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-warm-faint">No winner recorded.</p>
      )}

      {nominees.length > 0 && (
        <div className="mt-3 border-t border-gold pt-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Nominees</p>
          <div className="space-y-3">
            {nominees.map((n) => (
              <NomineeRow key={n.id} row={n} categoryName={category.name} photos={photos} narratorPhotos={narratorPhotos} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
