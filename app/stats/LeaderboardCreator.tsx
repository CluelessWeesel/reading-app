"use client";

import { useMemo, useState } from "react";
import { fraunces } from "../shared/fonts";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { AuthorName, RankedList, pillClass } from "./LeaderboardShared";
import { buildAuthorIdMap, computeFlatLeaderboards, computeSeriesLeaderboards, METRIC_LABELS, METRICS } from "./leaderboardMath";
import type { MetricKey } from "./leaderboardMath";
import type { BookSummary, SeriesParent } from "./types";

type GroupBy =
  | "author"
  | "series"
  | "genre"
  | "subgenre"
  | "format"
  | "format_detail"
  | "narrator"
  | "decade"
  | "year_read";
type DateBasis = "year_read" | "date_finished";
type FormatFilter = "all" | "physical" | "audio" | "ebook";

const GROUP_BY_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "author", label: "Author" },
  { key: "series", label: "Series" },
  { key: "genre", label: "Genre" },
  { key: "subgenre", label: "Subgenre" },
  { key: "format", label: "Format" },
  { key: "format_detail", label: "Format detail" },
  { key: "narrator", label: "Narrator" },
  { key: "decade", label: "Decade published" },
  { key: "year_read", label: "Year read" },
];

const FORMAT_FILTERS: FormatFilter[] = ["all", "physical", "audio", "ebook"];

function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

// Every flat (non-hierarchical) grouping's key extractor. Series is handled
// separately since it needs the parent-chain rollup in computeSeriesLeaderboards.
function flatGroupKeyFor(groupBy: Exclude<GroupBy, "series">): (b: BookSummary) => string | null {
  switch (groupBy) {
    case "author":
      return (b) => b.author;
    case "genre":
      return (b) => b.genre;
    case "subgenre":
      return (b) => b.subgenre;
    case "format":
      return (b) => (b.format_type ? (FORMAT_LABELS[b.format_type] ?? b.format_type) : null);
    case "format_detail":
      return (b) => b.format_raw;
    case "narrator":
      return (b) => b.narrator;
    case "decade":
      return (b) => (b.year_released != null ? decadeOf(b.year_released) : null);
    case "year_read":
      return (b) => (b.year_read != null ? String(b.year_read) : null);
  }
}

// A fully manual leaderboard: pick a grouping (author, series, genre,
// subgenre, format, narrator, decade published, or year read), a metric, a
// date basis (year_read, matching the rest of the page, or an arbitrary
// date_finished range for questions like "before Aug 2025"), and a format
// filter -- e.g. "pages read per author in 2023, ebooks only" or "words
// finished in series before Aug 2025". Reuses the same aggregation
// functions as the cards above, just fed a differently-filtered book list.
export function LeaderboardCreator({
  books,
  seriesParents,
}: {
  books: BookSummary[];
  seriesParents: SeriesParent[];
}) {
  const years = useMemo(
    () =>
      Array.from(new Set(books.filter((b) => b.year_read != null).map((b) => b.year_read))).sort((a, b) => a - b),
    [books]
  );
  const authorIdMap = useMemo(() => buildAuthorIdMap(books), [books]);

  const [groupBy, setGroupBy] = useState<GroupBy>("author");
  const [metric, setMetric] = useState<MetricKey>("pages");
  const [dateBasis, setDateBasis] = useState<DateBasis>("year_read");
  const [year, setYear] = useState<number | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState<FormatFilter>("all");
  const [minBooksOn, setMinBooksOn] = useState(false);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      // A book only counts once actually finished -- a couple of books
      // carry a year_read (or none at all) with no date_finished, score, or
      // status, and aren't done yet.
      if (!b.date_finished) return false;
      if (format !== "all" && b.format_type !== format) return false;
      if (dateBasis === "year_read") {
        if (year !== "all" && b.year_read !== year) return false;
      } else {
        if (dateFrom && b.date_finished < dateFrom) return false;
        if (dateTo && b.date_finished > dateTo) return false;
      }
      return true;
    });
  }, [books, format, dateBasis, year, dateFrom, dateTo]);

  const results = useMemo(() => {
    if (groupBy === "series") {
      return computeSeriesLeaderboards(filteredBooks, seriesParents, minBooksOn ? 2 : 1)[metric];
    }
    return computeFlatLeaderboards(filteredBooks, flatGroupKeyFor(groupBy), minBooksOn ? 2 : 1)[metric];
  }, [groupBy, filteredBooks, seriesParents, metric, minBooksOn]);

  const description = useMemo(() => {
    const groupLabel = GROUP_BY_OPTIONS.find((g) => g.key === groupBy)?.label ?? groupBy;
    const parts = [METRIC_LABELS[metric], `by ${groupLabel}`];
    if (dateBasis === "year_read") {
      parts.push(year === "all" ? "All time" : String(year));
    } else if (dateFrom && dateTo) {
      parts.push(`finished ${dateFrom} to ${dateTo}`);
    } else if (dateTo) {
      parts.push(`finished before ${dateTo}`);
    } else if (dateFrom) {
      parts.push(`finished after ${dateFrom}`);
    } else {
      parts.push("any finish date");
    }
    if (format !== "all") parts.push(`${FORMAT_LABELS[format] ?? format} only`);
    return parts.join(" · ");
  }, [metric, groupBy, dateBasis, year, dateFrom, dateTo, format]);

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <h3 className={`${fraunces.className} mb-3 text-base font-semibold text-ink`}>Leaderboard creator</h3>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Group by</span>
          {GROUP_BY_OPTIONS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroupBy(g.key)}
              aria-pressed={groupBy === g.key}
              className={pillClass(groupBy === g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Metric</span>
          {METRICS.map((m) => (
            <button key={m} type="button" onClick={() => setMetric(m)} aria-pressed={metric === m} className={pillClass(metric === m)}>
              {METRIC_LABELS[m]}
            </button>
          ))}
          {(metric === "avgScore" || metric === "avgPercentile") && (
            <button
              type="button"
              onClick={() => setMinBooksOn((v) => !v)}
              aria-pressed={minBooksOn}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                minBooksOn ? "border-accent bg-accent/10 text-ink" : "border-hairline text-ink-faint hover:text-ink"
              }`}
            >
              2+ books
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Date basis</span>
          {(["year_read", "date_finished"] as DateBasis[]).map((d) => (
            <button key={d} type="button" onClick={() => setDateBasis(d)} aria-pressed={dateBasis === d} className={pillClass(dateBasis === d)}>
              {d === "year_read" ? "Year read" : "Date finished"}
            </button>
          ))}

          {dateBasis === "year_read" ? (
            <select
              value={year}
              onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-full border border-hairline bg-card/70 px-3 py-1 text-xs text-ink shadow-sm outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="all">All time</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Finished after"
                className="rounded-full border border-hairline bg-card/70 px-3 py-1 text-xs text-ink shadow-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
              <span className="text-xs text-ink-faint">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Finished before"
                className="rounded-full border border-hairline bg-card/70 px-3 py-1 text-xs text-ink shadow-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Format</span>
          {FORMAT_FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={pillClass(format === f)}>
              {f === "all" ? "All" : (FORMAT_LABELS[f] ?? f)}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs text-ink-faint">{description}</p>

      <RankedList
        entries={results}
        renderName={groupBy === "author" ? (e) => <AuthorName name={e.name} authorId={authorIdMap.get(e.name)} /> : undefined}
      />
    </div>
  );
}
