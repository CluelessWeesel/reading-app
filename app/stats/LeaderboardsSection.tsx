"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { fraunces } from "../shared/fonts";
import { LeaderboardCreator } from "./LeaderboardCreator";
import { AuthorName, RankedList, pillClass } from "./LeaderboardShared";
import {
  buildAuthorIdMap,
  computeBookPaceLeaderboard,
  computeFlatLeaderboards,
  computeSeriesLeaderboards,
  METRIC_LABELS,
  METRICS,
} from "./leaderboardMath";
import type { BookFormatFilter, LeaderboardEntry, MetricKey, SeriesLevelFilter } from "./leaderboardMath";
import { SectionShell } from "./SectionShell";
import type { BookSummary, Scope, SeriesParent } from "./types";

function BookTitle({ entry }: { entry: LeaderboardEntry }) {
  if (entry.bookId == null) return <span className="truncate text-ink">{entry.name}</span>;
  return (
    <Link href={`/books/${entry.bookId}`} className="truncate text-ink hover:underline">
      {entry.name}
    </Link>
  );
}

function MinBooksToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        on ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-faint hover:text-ink"
      }`}
    >
      2+ books
    </button>
  );
}

function LeaderboardCard({
  title,
  entriesByMetric,
  renderName,
  showMinBooksToggle,
  minBooksOn,
  onToggleMinBooks,
  dimensionToggle,
  onlyMetrics,
}: {
  title: string;
  entriesByMetric: Record<MetricKey, LeaderboardEntry[]>;
  renderName?: (entry: LeaderboardEntry) => ReactNode;
  showMinBooksToggle: boolean;
  minBooksOn: boolean;
  onToggleMinBooks: () => void;
  // An extra pill row above the metric selector -- e.g. Genre/Subgenre, or
  // Author/Series for the Consistency card, which doesn't have one fixed
  // grouping the way Authors/Series/Format do.
  dimensionToggle?: { options: { key: string; label: string }[]; value: string; onChange: (key: string) => void };
  // Restricts which metrics are selectable -- Consistency only ever shows
  // avgPercentile, so there's no pill row to pick a metric at all.
  onlyMetrics?: MetricKey[];
}) {
  const metricsToShow = onlyMetrics ?? METRICS;
  const [metric, setMetric] = useState<MetricKey>(metricsToShow[0]);
  const activeMetric = metricsToShow.includes(metric) ? metric : metricsToShow[0];

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <h3 className={`${fraunces.className} mb-3 text-base font-semibold text-ink`}>{title}</h3>

      {dimensionToggle && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {dimensionToggle.options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => dimensionToggle.onChange(o.key)}
              aria-pressed={dimensionToggle.value === o.key}
              className={pillClass(dimensionToggle.value === o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {metricsToShow.length > 1 &&
          metricsToShow.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={activeMetric === m}
              className={pillClass(activeMetric === m)}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        {showMinBooksToggle && (activeMetric === "avgScore" || activeMetric === "avgPercentile") && (
          <MinBooksToggle on={minBooksOn} onToggle={onToggleMinBooks} />
        )}
      </div>

      <RankedList entries={entriesByMetric[activeMetric]} renderName={renderName} />
    </div>
  );
}

function BookPaceCard({
  combined,
  physical,
  audio,
}: {
  combined: LeaderboardEntry[];
  physical: LeaderboardEntry[];
  audio: LeaderboardEntry[];
}) {
  const [mode, setMode] = useState<"combined" | "split">("combined");

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <h3 className={`${fraunces.className} mb-3 text-base font-semibold text-ink`}>Books, fastest to slowest</h3>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode("combined")} aria-pressed={mode === "combined"} className={pillClass(mode === "combined")}>
          Combined
        </button>
        <button type="button" onClick={() => setMode("split")} aria-pressed={mode === "split"} className={pillClass(mode === "split")}>
          Split by format
        </button>
      </div>

      {mode === "combined" ? (
        <RankedList entries={combined} renderName={(e) => <BookTitle entry={e} />} />
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-faint">Physical</h4>
            <RankedList entries={physical} renderName={(e) => <BookTitle entry={e} />} />
          </div>
          <div>
            <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-faint">Audio</h4>
            <RankedList entries={audio} renderName={(e) => <BookTitle entry={e} />} />
          </div>
        </div>
      )}
    </div>
  );
}

function formatTypeGroupKey(b: BookSummary): string | null {
  return b.format_type ? (FORMAT_LABELS[b.format_type] ?? b.format_type) : null;
}
// The specific source/edition (Libby, Hardcover, Audible, ...) rather than
// the broad physical/audio/ebook bucket.
function formatDetailGroupKey(b: BookSummary): string | null {
  return b.format_raw;
}

export function LeaderboardsSection({
  books,
  seriesParents,
  scope,
}: {
  books: BookSummary[];
  seriesParents: SeriesParent[];
  scope: Scope;
}) {
  const [authorMinBooksOn, setAuthorMinBooksOn] = useState(true);
  const [seriesMinBooksOn, setSeriesMinBooksOn] = useState(true);
  const [seriesLevelFilter, setSeriesLevelFilter] = useState<SeriesLevelFilter>("all");
  const [genreDimension, setGenreDimension] = useState<"genre" | "subgenre">("genre");
  const [genreMinBooksOn, setGenreMinBooksOn] = useState(true);
  const [formatDimension, setFormatDimension] = useState<"type" | "detail">("type");
  const [formatMinBooksOn, setFormatMinBooksOn] = useState(true);
  const [consistencyGroupBy, setConsistencyGroupBy] = useState<"author" | "series">("author");
  const [consistencyMinBooksOn, setConsistencyMinBooksOn] = useState(true);

  // A book only counts once actually finished -- a couple of books carry a
  // year_read (or none at all) with no date_finished, score, or status, and
  // aren't done yet.
  const scopedBooks = useMemo(
    () => books.filter((b) => b.date_finished != null && (scope.kind === "all" || b.year_read === scope.year)),
    [books, scope]
  );
  const authorIdMap = useMemo(() => buildAuthorIdMap(books), [books]);

  const authorBoards = useMemo(
    () => computeFlatLeaderboards(scopedBooks, (b) => b.author, authorMinBooksOn ? 2 : 1),
    [scopedBooks, authorMinBooksOn]
  );
  const seriesBoards = useMemo(
    () => computeSeriesLeaderboards(scopedBooks, seriesParents, seriesMinBooksOn ? 2 : 1, seriesLevelFilter),
    [scopedBooks, seriesParents, seriesMinBooksOn, seriesLevelFilter]
  );
  const genreBoards = useMemo(
    () =>
      computeFlatLeaderboards(
        scopedBooks,
        (b) => (genreDimension === "genre" ? b.genre : b.subgenre),
        genreMinBooksOn ? 2 : 1
      ),
    [scopedBooks, genreDimension, genreMinBooksOn]
  );
  const formatBoards = useMemo(
    () =>
      computeFlatLeaderboards(
        scopedBooks,
        formatDimension === "type" ? formatTypeGroupKey : formatDetailGroupKey,
        formatMinBooksOn ? 2 : 1
      ),
    [scopedBooks, formatDimension, formatMinBooksOn]
  );
  const consistencyAuthorBoards = useMemo(
    () => computeFlatLeaderboards(scopedBooks, (b) => b.author, consistencyMinBooksOn ? 2 : 1),
    [scopedBooks, consistencyMinBooksOn]
  );
  const consistencySeriesBoards = useMemo(
    () => computeSeriesLeaderboards(scopedBooks, seriesParents, consistencyMinBooksOn ? 2 : 1),
    [scopedBooks, seriesParents, consistencyMinBooksOn]
  );

  const bookPaceBoards = useMemo(() => {
    const byFormat: Record<BookFormatFilter, LeaderboardEntry[]> = {
      all: computeBookPaceLeaderboard(scopedBooks, "all"),
      physical: computeBookPaceLeaderboard(scopedBooks, "physical"),
      audio: computeBookPaceLeaderboard(scopedBooks, "audio"),
    };
    return byFormat;
  }, [scopedBooks]);

  return (
    <SectionShell title="Leaderboards">
      <div className="grid gap-4 md:grid-cols-3">
        <LeaderboardCard
          title="Authors"
          entriesByMetric={authorBoards}
          renderName={(e) => <AuthorName name={e.name} authorId={authorIdMap.get(e.name)} />}
          showMinBooksToggle
          minBooksOn={authorMinBooksOn}
          onToggleMinBooks={() => setAuthorMinBooksOn((v) => !v)}
        />
        <LeaderboardCard
          title="Series"
          entriesByMetric={seriesBoards}
          showMinBooksToggle
          minBooksOn={seriesMinBooksOn}
          onToggleMinBooks={() => setSeriesMinBooksOn((v) => !v)}
          dimensionToggle={{
            options: [
              { key: "all", label: "All" },
              { key: "main", label: "Main" },
              { key: "sub", label: "Sub" },
            ],
            value: seriesLevelFilter,
            onChange: (key) => setSeriesLevelFilter(key as SeriesLevelFilter),
          }}
        />
        <BookPaceCard combined={bookPaceBoards.all} physical={bookPaceBoards.physical} audio={bookPaceBoards.audio} />

        <LeaderboardCard
          title="Genre"
          entriesByMetric={genreBoards}
          showMinBooksToggle
          minBooksOn={genreMinBooksOn}
          onToggleMinBooks={() => setGenreMinBooksOn((v) => !v)}
          dimensionToggle={{
            options: [
              { key: "genre", label: "Genre" },
              { key: "subgenre", label: "Subgenre" },
            ],
            value: genreDimension,
            onChange: (key) => setGenreDimension(key as "genre" | "subgenre"),
          }}
        />
        <LeaderboardCard
          title="Format"
          entriesByMetric={formatBoards}
          showMinBooksToggle
          minBooksOn={formatMinBooksOn}
          onToggleMinBooks={() => setFormatMinBooksOn((v) => !v)}
          dimensionToggle={{
            options: [
              { key: "type", label: "Format" },
              { key: "detail", label: "Detail" },
            ],
            value: formatDimension,
            onChange: (key) => setFormatDimension(key as "type" | "detail"),
          }}
        />
        <LeaderboardCard
          title="Consistency"
          entriesByMetric={consistencyGroupBy === "author" ? consistencyAuthorBoards : consistencySeriesBoards}
          renderName={consistencyGroupBy === "author" ? (e) => <AuthorName name={e.name} authorId={authorIdMap.get(e.name)} /> : undefined}
          showMinBooksToggle
          minBooksOn={consistencyMinBooksOn}
          onToggleMinBooks={() => setConsistencyMinBooksOn((v) => !v)}
          onlyMetrics={["avgPercentile"]}
          dimensionToggle={{
            options: [
              { key: "author", label: "Author" },
              { key: "series", label: "Series" },
            ],
            value: consistencyGroupBy,
            onChange: (key) => setConsistencyGroupBy(key as "author" | "series"),
          }}
        />
      </div>

      <div className="mt-4">
        <LeaderboardCreator books={books} seriesParents={seriesParents} />
      </div>
    </SectionShell>
  );
}
