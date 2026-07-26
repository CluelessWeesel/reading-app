"use client";

import { useMemo } from "react";
import { MAX_TIER_ORDER } from "../movementMath";
import { TierDimensionCard } from "./TierDimensionCard";
import {
  groupByAuthor,
  groupByDecade,
  groupByFormat,
  groupByGenre,
  groupBySeries,
  groupByYearRead,
  tierOrdinalLabel,
} from "./dimensionMath";
import type { SeriesParent, TierStatBook } from "./types";

function formatTierValue(value: number): string {
  return `${tierOrdinalLabel(value)} (${value.toFixed(1)})`;
}

// Shared tail appended to every card's tooltip -- what the bar/number
// actually measures, common to all six groupings.
const AVG_TIER_NOTE =
  "Average tier of the group's placed books, on a 1-7 scale (F=1 ... S=7). Holding books are left out of the average since they haven't been judged yet, but the 'N in S' badge still counts them toward S if any made it there.";

const AUTHOR_DESCRIPTION = `Grouped by author, minimum 2 placed books (so one book doesn't read as an author's whole track record). ${AVG_TIER_NOTE}`;

const SERIES_DESCRIPTION = `Books are rolled up to the TOP of their series family via the series table's parent-series ladder -- e.g. every Middle Earth book (The Hobbit, the Lord of the Rings trilogy, ...) counts once toward "Middle Earth" as a whole, instead of being split between "The Hobbit" and "Lord of the Rings" separately. That's so a saga's overall standing isn't diluted by how finely its sub-series happen to be tagged. Minimum 2 placed books in the family. ${AVG_TIER_NOTE}`;

const GENRE_DESCRIPTION = `Grouped by the book's tagged genre, minimum 2 placed books. ${AVG_TIER_NOTE}`;

const FORMAT_DESCRIPTION = `Grouped by physical / audiobook / ebook, minimum 2 placed books. ${AVG_TIER_NOTE}`;

const DECADE_DESCRIPTION = `Grouped by the decade the book was originally published. ${AVG_TIER_NOTE}`;

const YEAR_READ_DESCRIPTION = `Grouped by the year you finished each book -- but re-ranked by your CURRENT tier judgment, not the score you gave at the time. A year that felt mediocre when you rated it can read very differently once your taste has settled. ${AVG_TIER_NOTE}`;

export function TierByDimensionSection({ books, seriesParents }: { books: TierStatBook[]; seriesParents: SeriesParent[] }) {
  const authors = useMemo(() => groupByAuthor(books), [books]);
  const series = useMemo(() => groupBySeries(books, seriesParents), [books, seriesParents]);
  const genres = useMemo(() => groupByGenre(books), [books]);
  const formats = useMemo(() => groupByFormat(books), [books]);
  const decades = useMemo(() => groupByDecade(books), [books]);
  const yearsRead = useMemo(() => groupByYearRead(books), [books]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TierDimensionCard
        title="By author"
        description={AUTHOR_DESCRIPTION}
        subtitle="Authors with at least 2 placed books."
        groups={authors}
        valueOf={(g) => g.avgTierOrdinal}
        formatValue={(v) => formatTierValue(v)}
        maxValue={MAX_TIER_ORDER}
        showSBadge
      />
      <TierDimensionCard
        title="By series"
        description={SERIES_DESCRIPTION}
        subtitle="Rolled up through the parent series ladder."
        groups={series}
        valueOf={(g) => g.avgTierOrdinal}
        formatValue={(v) => formatTierValue(v)}
        maxValue={MAX_TIER_ORDER}
        showSBadge
      />
      <TierDimensionCard
        title="By genre"
        description={GENRE_DESCRIPTION}
        groups={genres}
        valueOf={(g) => g.avgTierOrdinal}
        formatValue={(v) => formatTierValue(v)}
        maxValue={MAX_TIER_ORDER}
        showSBadge
      />
      <TierDimensionCard
        title="By format"
        description={FORMAT_DESCRIPTION}
        groups={formats}
        valueOf={(g) => g.avgTierOrdinal}
        formatValue={(v) => formatTierValue(v)}
        maxValue={MAX_TIER_ORDER}
        showSBadge
      />
      <TierDimensionCard
        title="By publication decade"
        description={DECADE_DESCRIPTION}
        groups={decades}
        valueOf={(g) => g.avgTierOrdinal}
        formatValue={(v) => formatTierValue(v)}
        maxValue={MAX_TIER_ORDER}
        showSBadge
      />
      <TierDimensionCard
        title="Your years, judged from today"
        description={YEAR_READ_DESCRIPTION}
        subtitle="Reading years re-ranked by present-day tier, not the scores given at the time."
        groups={yearsRead}
        valueOf={(g) => g.avgTierOrdinal}
        formatValue={(v) => formatTierValue(v)}
        maxValue={MAX_TIER_ORDER}
        showSBadge
      />
    </div>
  );
}
