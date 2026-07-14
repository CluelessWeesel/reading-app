import Link from "next/link";
import { notFound } from "next/navigation";
import { fraunces } from "../../shared/fonts";
import { getAuthorPhotoMap } from "../../shared/authorPhotos";
import { getAmendments, getCategories, getSealedYears, getWeeselRows } from "../data";
import { computeYearCategoryBlocks } from "../weeselMath";
import { AmendControl } from "./AmendControl";
import { CategoryBlock } from "./CategoryBlock";

export const dynamic = "force-dynamic";

export default async function WeeselYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) notFound();

  const [categories, sealedYears, rows, photos, amendments] = await Promise.all([
    getCategories(),
    getSealedYears(),
    getWeeselRows(),
    getAuthorPhotoMap(),
    getAmendments(year),
  ]);
  const sealed = sealedYears.has(year);
  const yearRows = rows.filter((r) => r.year === year);
  const blocks = computeYearCategoryBlocks(year, rows, categories);
  const hasAnyData = yearRows.length > 0;

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/weesels"
          className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
        >
          ← The Weesels
        </Link>

        <header className="mb-6 mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>{year} Weesels</h1>
            <p className="mt-1 text-sm text-ink-faint">{sealed ? "Sealed" : "In season"}</p>
          </div>
          {sealed && hasAnyData && (
            <a
              href={`/api/weesels/${year}/share`}
              download
              className="mt-1 shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
            >
              Share this year
            </a>
          )}
        </header>

        {!hasAnyData ? (
          <p className="rounded-xl border border-hairline bg-card/40 p-6 text-center text-sm text-ink-faint">
            The {year} Weesels are still in season — check back once the year wraps.
          </p>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => (
              <CategoryBlock key={block.category.id} block={block} photos={photos} year={year} />
            ))}
          </div>
        )}

        {sealed && hasAnyData && (
          <div className="mt-6">
            {amendments.length > 0 && (
              <div className="mb-4 rounded-xl border border-hairline bg-card/30 p-4">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Amendments</h2>
                <ul className="space-y-2">
                  {amendments.map((a) => (
                    <li key={a.id} className="text-xs text-ink-faint">
                      <span className="text-ink-muted">{a.amended_at}</span>
                      {a.category_name && <span> · {a.category_name}</span>} — {a.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AmendControl year={year} blocks={blocks} />
          </div>
        )}
      </div>
    </div>
  );
}
