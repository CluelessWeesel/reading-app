import Link from "next/link";
import { AuthorPhoto } from "../../authors/AuthorPhoto";
import { CoverThumb } from "../../shared/CoverThumb";
import { fraunces } from "../../shared/fonts";
import { creditedAuthorId, creditedAuthorName, displayTitle, isAuthorIdentityCategory } from "../weeselMath";
import type { YearCategoryBlock } from "../types";

// The circular author photo, same visual as their own page -- used both as
// a category's primary line (Author of the Year, where the nominee *is*
// the author) and as the "by so-and-so" sub-line under a book/series entry.
function AuthorLink({
  name,
  authorId,
  photos,
  size = "sm",
}: {
  name: string;
  authorId: number | null;
  photos: Record<number, string | null>;
  size?: "sm" | "lg";
}) {
  const photoClass = size === "lg" ? "aspect-square w-6" : "aspect-square w-4";
  const textClass = size === "lg" ? `${fraunces.className} text-lg font-semibold text-ink` : "truncate text-xs text-ink-faint";
  if (authorId == null) {
    return <p className={textClass}>{name}</p>;
  }
  return (
    <Link href={`/authors/${authorId}`} className={`inline-flex min-w-0 items-center gap-1.5 hover:underline ${textClass}`}>
      <AuthorPhoto name={name} photoUrl={photos[authorId] ?? null} className={`${photoClass} shrink-0`} initialClassName="text-[8px]" />
      <span className="truncate">{name}</span>
    </Link>
  );
}

function NomineeRow({
  row,
  categoryName,
  photos,
}: {
  row: YearCategoryBlock["nominees"][number];
  categoryName: string;
  photos: Record<number, string | null>;
}) {
  const title = displayTitle(row);
  const authorName = creditedAuthorName(row, categoryName);
  const authorId = creditedAuthorId(row, categoryName);

  if (isAuthorIdentityCategory(categoryName)) {
    return <AuthorLink name={authorName ?? title} authorId={authorId} photos={photos} />;
  }

  const content = (
    <>
      {row.book_id != null && <CoverThumb title={title} coverUrl={row.cover_url} className="aspect-[2/3] w-8" />}
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{title}</p>
        {authorName && <AuthorLink name={authorName} authorId={authorId} photos={photos} />}
      </div>
    </>
  );
  if (row.book_id != null) {
    return (
      <Link href={`/books/${row.book_id}`} className="flex items-center gap-2 hover:underline">
        {content}
      </Link>
    );
  }
  return <div className="flex items-center gap-2">{content}</div>;
}

export function CategoryBlock({
  block,
  photos,
  year,
}: {
  block: YearCategoryBlock;
  photos: Record<number, string | null>;
  year: number;
}) {
  const { category, status, winner, nominees } = block;

  if (status === "not-yet-existing") return null;

  if (status === "did-not-run") {
    return (
      <details className="rounded-lg border border-hairline bg-card/30 px-3 py-2">
        <summary className="cursor-pointer text-sm text-ink-faint">{category.name}</summary>
        <p className="mt-1 text-xs text-ink-faint">Did not run — insufficient candidates.</p>
      </details>
    );
  }

  const authorIdentity = isAuthorIdentityCategory(category.name);
  const winnerTitle = winner ? displayTitle(winner) : null;
  const winnerAuthorName = winner ? creditedAuthorName(winner, category.name) : null;
  const winnerAuthorId = winner ? creditedAuthorId(winner, category.name) : null;

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`${fraunces.className} text-base font-semibold text-ink`}>{category.name}</h3>
        {winner && (
          <a
            href={`/api/weesels/${year}/share/${category.id}`}
            download
            className="shrink-0 text-[10px] text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
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
            <p className="text-xs uppercase tracking-wide text-ink-faint">🏆 Winner</p>
            {authorIdentity ? (
              <AuthorLink name={winnerAuthorName ?? (winnerTitle as string)} authorId={winnerAuthorId} photos={photos} size="lg" />
            ) : winner.book_id != null ? (
              <Link
                href={`/books/${winner.book_id}`}
                className={`${fraunces.className} block truncate text-lg font-semibold text-ink hover:underline`}
              >
                {winnerTitle}
              </Link>
            ) : (
              <p className={`${fraunces.className} truncate text-lg font-semibold text-ink`}>{winnerTitle}</p>
            )}
            {!authorIdentity && winnerAuthorName && (
              <AuthorLink name={winnerAuthorName} authorId={winnerAuthorId} photos={photos} />
            )}
            {winner.citation ? (
              <p className="mt-1 text-sm italic text-ink-muted">&ldquo;{winner.citation}&rdquo;</p>
            ) : (
              <p className="mt-1 text-xs text-ink-faint">No citation yet — add one to remember why this won.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No winner recorded.</p>
      )}

      {nominees.length > 0 && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-faint">Nominees</p>
          <div className="space-y-2">
            {nominees.map((n) => (
              <NomineeRow key={n.id} row={n} categoryName={category.name} photos={photos} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
