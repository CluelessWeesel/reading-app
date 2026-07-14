import Link from "next/link";
import { CoverThumb } from "../shared/CoverThumb";
import { StarRating } from "../library/StarRating";
import { fraunces } from "../shared/fonts";
import { WidgetShell } from "./WidgetShell";
import type { LatestFinish } from "./types";

export function LatestFinishWidget({ finish }: { finish: LatestFinish }) {
  return (
    <WidgetShell title="Latest finish">
      <Link href={`/books/${finish.book_id}`} className="flex items-center gap-4">
        <CoverThumb title={finish.title} coverUrl={finish.cover_url} className="aspect-[2/3] w-16" />
        <div className="min-w-0 flex-1">
          <p className={`${fraunces.className} truncate text-lg font-semibold text-ink hover:underline`}>
            {finish.title}
          </p>
          <p className="truncate text-xs text-ink-faint">{finish.author}</p>
          <div className="mt-1">
            <StarRating score={finish.score} />
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {finish.ranking && (
              <span
                className="mr-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: finish.ranking.background, color: finish.ranking.color }}
              >
                #{finish.ranking.rank} of {finish.ranking.total}
              </span>
            )}
            {finish.days != null && `${finish.days} day${finish.days === 1 ? "" : "s"}`}
          </p>
        </div>
      </Link>
    </WidgetShell>
  );
}
