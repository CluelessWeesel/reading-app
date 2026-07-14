import Link from "next/link";
import { fraunces } from "../../../shared/fonts";
import { CoverThumb } from "../../../shared/CoverThumb";
import { AuthorPhoto } from "../../../authors/AuthorPhoto";
import { PreflightCard } from "./PreflightCard";
import type { CeremonyCategoryData } from "./CeremonyView";
import type { AuthorOption, YearFinishedBook } from "../types";

function ConfirmedCard({ data }: { data: CeremonyCategoryData }) {
  const { category, status } = data;
  const nominees = status.state === "confirmed-running" || status.state === "revealed" ? status.nominees : [];
  const running = status.state !== "confirmed-not-running";

  return (
    <div className="rounded-xl border border-hairline bg-card/20 p-4 opacity-80">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={`${fraunces.className} text-base font-semibold text-ink`}>{category.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            running ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-hairline text-ink-faint"
          }`}
        >
          Confirmed · {running ? "RUNS" : "DOES NOT RUN"}
        </span>
      </div>
      {nominees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nominees.map((n) => (
            <div key={n.weeselId} className="flex items-center gap-1.5 rounded-full border border-hairline bg-card/70 px-2 py-1 text-xs">
              {n.bookId != null ? (
                <CoverThumb title={n.label} coverUrl={n.coverUrl} className="aspect-[2/3] w-4" />
              ) : (
                <AuthorPhoto name={n.label} photoUrl={n.photoUrl} className="aspect-square w-4" initialClassName="text-[7px]" />
              )}
              <span className="text-ink">{n.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreflightBoard({
  year,
  categoryData,
  yearBooks,
  allAuthors,
  onConfirmed,
}: {
  year: number;
  categoryData: CeremonyCategoryData[];
  yearBooks: YearFinishedBook[];
  allAuthors: AuthorOption[];
  onConfirmed: () => void;
}) {
  const reviewedCount = categoryData.filter((c) => c.status.state !== "unreviewed").length;

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/weesels" className="text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink">
          ← The Weesels
        </Link>

        <header className="mb-6 mt-3">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>{year} Weesels — Pre-flight</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {reviewedCount} of {categoryData.length} categories reviewed
          </p>
        </header>

        <div className="space-y-4">
          {categoryData.map((data) =>
            data.status.state === "unreviewed" ? (
              <PreflightCard
                key={data.category.id}
                year={year}
                category={data.category}
                computedPool={data.computedPool}
                watchedSuggestions={data.watchedSuggestions}
                isManualPick={data.isManualPick}
                yearBooks={yearBooks}
                allAuthors={allAuthors}
                onConfirmed={onConfirmed}
              />
            ) : (
              <ConfirmedCard key={data.category.id} data={data} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
