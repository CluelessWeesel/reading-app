import Link from "next/link";
import { CoverThumb } from "../shared/CoverThumb";
import { WidgetShell } from "./WidgetShell";
import type { ShelfPick } from "./types";

export function FromShelvesWidget({ pick }: { pick: ShelfPick }) {
  if (!pick) return null;

  return (
    <WidgetShell title="From the shelves">
      <Link href={`/books/${pick.book_id}`} className="flex items-center gap-3">
        <CoverThumb title={pick.title} coverUrl={pick.cover_url} className="aspect-[2/3] w-10" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink hover:underline">{pick.title}</p>
          <p className="truncate text-xs text-ink-faint">Remember this one? · {pick.author}</p>
        </div>
      </Link>
    </WidgetShell>
  );
}
