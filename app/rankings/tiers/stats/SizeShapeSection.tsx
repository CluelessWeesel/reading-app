"use client";

import { useMemo } from "react";
import { TierDimensionCard } from "./TierDimensionCard";
import { avgDaysToFinish, avgPace, avgPages, avgWords, buildPlaceableTierGroups } from "./sizeShapeMath";
import type { TierStatBook } from "./types";

export function SizeShapeSection({ books }: { books: TierStatBook[] }) {
  const groups = useMemo(() => buildPlaceableTierGroups(books), [books]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TierDimensionCard
        title="Pages"
        description="Average page count of the books currently sitting in each tier -- Holding is left out, since this section is asking whether length earns a judged tier. A high bar means that tier tends to hold longer books."
        subtitle="Average page count per tier."
        groups={groups}
        valueOf={avgPages}
        formatValue={(v) => `${Math.round(v)} pg`}
      />
      <TierDimensionCard
        title="Words"
        description="Average word count per tier. Not every book has a word count logged, so those are skipped rather than treated as zero."
        subtitle="Average word count per tier (some books have none logged)."
        groups={groups}
        valueOf={avgWords}
        formatValue={(v) => `${Math.round(v).toLocaleString()} words`}
      />
      <TierDimensionCard
        title="Days to finish"
        description="Average number of days from date started to date finished, per tier -- only counts books with both dates logged."
        subtitle="Average time from start to finish per tier."
        groups={groups}
        valueOf={avgDaysToFinish}
        formatValue={(v) => `${v.toFixed(1)} days`}
      />
      <TierDimensionCard
        title="Reading pace"
        description="Average pages-per-day per tier, using each book's own logged pace. A faster pace here could mean a page-turner, or just a shorter/easier book -- cross-check against the Pages card."
        subtitle="Average pages/day per tier."
        groups={groups}
        valueOf={avgPace}
        formatValue={(v) => `${v.toFixed(1)} pg/day`}
      />
    </div>
  );
}
