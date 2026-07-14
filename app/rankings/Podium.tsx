import Link from "next/link";
import { CoverThumb } from "../shared/CoverThumb";
import { fraunces } from "../shared/fonts";
import type { RankedRow } from "./types";

// Pedestal blocks of different heights (aligned via items-end on the
// parent row) are what actually reads as "elevated" -- padding/margin
// tricks on the cover itself don't visually raise anything.
function PodiumColumn({
  row,
  place,
  pedestalHeight,
  coverWidth,
}: {
  row: RankedRow;
  place: 1 | 2 | 3;
  pedestalHeight: string;
  coverWidth: string;
}) {
  const inner = (
    <>
      <CoverThumb title={row.title} coverUrl={row.cover_url} className={`aspect-[2/3] ${coverWidth} shadow-lg`} />
      <p className="mt-2 max-w-full truncate text-center text-xs font-medium text-ink">{row.title}</p>
      <p className="max-w-full truncate text-center text-[10px] text-ink-faint">{row.author ?? ""}</p>
      <div
        className={`mt-2 flex ${pedestalHeight} w-full items-start justify-center rounded-t-lg bg-accent/15 pt-1`}
      >
        <span className={`${fraunces.className} text-xl font-bold text-ink`}>{place}</span>
      </div>
    </>
  );

  return (
    <div className="flex w-24 flex-col items-center sm:w-28">
      {row.book_id != null ? (
        <Link href={`/books/${row.book_id}`} className="contents hover:opacity-90">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

export function Podium({ ranked }: { ranked: RankedRow[] }) {
  const [first, second, third] = ranked;
  if (!first) return null;

  return (
    <div className="mb-6 flex items-end justify-center gap-3 rounded-xl border border-hairline bg-card/40 p-6 sm:gap-6">
      {second && <PodiumColumn row={second} place={2} pedestalHeight="h-12" coverWidth="w-16 sm:w-20" />}
      <PodiumColumn row={first} place={1} pedestalHeight="h-20" coverWidth="w-20 sm:w-24" />
      {third && <PodiumColumn row={third} place={3} pedestalHeight="h-8" coverWidth="w-16 sm:w-20" />}
    </div>
  );
}
