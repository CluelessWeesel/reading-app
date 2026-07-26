"use client";

import { computeGenreDiet } from "@/app/home/genreDietMath";
import type { GenreDiet } from "@/app/home/genreDietMath";
import { computePublicationEra } from "../distributionMath";
import { CompareSection } from "./CompareSection";
import { computeGenreEraVerdict, computeGenreShift } from "./compareVerdicts";
import type { CompareScopeData } from "./compareScopeMath";

function avgReleaseYear(books: { year_released: number | null }[]): number | null {
  const withYear = books.filter((b): b is { year_released: number } => b.year_released != null);
  if (withYear.length === 0) return null;
  return withYear.reduce((sum, b) => sum + b.year_released, 0) / withYear.length;
}

// Every slice's accent is a CSS custom property reference (var(--accent-x)),
// not a Tailwind utility class -- Tailwind's compiler can't see a
// runtime-built class name, so this uses inline style the same way
// WidgetCard.tsx's own accentStyle() already does for the same WidgetAccent type.
function DietBars({ diet }: { diet: GenreDiet }) {
  return (
    <div className="space-y-1.5">
      {diet.slices.map((s) => (
        <div key={s.genre} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-ink-warm-faint">{s.genre}</span>
          <span className="h-3 flex-1 overflow-hidden rounded bg-hairline">
            <span className="block h-full rounded" style={{ width: `${s.percent}%`, backgroundColor: `var(--accent-${s.accent})` }} />
          </span>
          <span className="w-10 shrink-0 text-right text-ink-warm">{s.percent.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

export function GenreEraSection({ left, right }: { left: CompareScopeData; right: CompareScopeData }) {
  if (left.books.length === 0 || right.books.length === 0) {
    return <CompareSection title="Genre & era" notTracked={`Not tracked for ${left.books.length === 0 ? left.label : right.label} -- no real books in scope.`} />;
  }

  const leftDiet = computeGenreDiet(left.books, "0000-01-01");
  const rightDiet = computeGenreDiet(right.books, "0000-01-01");

  if (!leftDiet || !rightDiet) {
    return <CompareSection title="Genre & era" notTracked="Not enough genre variety in one of these to compare." />;
  }

  const shift = computeGenreShift(leftDiet.slices, rightDiet.slices);
  const leftAvgYear = avgReleaseYear(left.books);
  const rightAvgYear = avgReleaseYear(right.books);
  const verdict = computeGenreEraVerdict(shift, left.label, right.label, leftAvgYear, rightAvgYear);

  const leftEra = computePublicationEra(left.books);
  const rightEra = computePublicationEra(right.books);

  return (
    <CompareSection title="Genre & era" verdict={verdict}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">{left.label}</p>
          <DietBars diet={leftDiet} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">{right.label}</p>
          <DietBars diet={rightDiet} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="mb-1 text-ink-warm-faint">
            Avg. publication year: <span className="text-ink-warm">{leftAvgYear != null ? Math.round(leftAvgYear) : "--"}</span>
          </p>
          <p className="text-ink-warm-faint">{leftEra.buckets.length} era{leftEra.buckets.length === 1 ? "" : "s"} represented</p>
        </div>
        <div>
          <p className="mb-1 text-ink-warm-faint">
            Avg. publication year: <span className="text-ink-warm">{rightAvgYear != null ? Math.round(rightAvgYear) : "--"}</span>
          </p>
          <p className="text-ink-warm-faint">{rightEra.buckets.length} era{rightEra.buckets.length === 1 ? "" : "s"} represented</p>
        </div>
      </div>
    </CompareSection>
  );
}
