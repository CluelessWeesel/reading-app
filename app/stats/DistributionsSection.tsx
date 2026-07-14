"use client";

import { useMemo, useState } from "react";
import { daysBetweenInclusive } from "../shared/isoDate";
import { DistributionCard } from "./DistributionCard";
import type { Marker } from "./DistributionCard";
import { pillClass } from "./DistributionShared";
import {
  SCORE_STEPS,
  computeDaysToFinishHistogram,
  computeFormatSplit,
  computeGenreSplit,
  computeLengthHistogram,
  computePaceHistogram,
  computePublicationEra,
  computeScoreHistogram,
  markerPosition,
} from "./distributionMath";
import type { Bucket } from "./distributionMath";
import { RatingByGenreCard } from "./RatingByGenreCard";
import { SectionShell } from "./SectionShell";
import type { BookSummary, Scope } from "./types";

function excludedNoteFor(excluded: number, reason: string): string | null {
  return excluded > 0 ? `${excluded} book${excluded === 1 ? "" : "s"} excluded (${reason})` : null;
}

function countLabel(n: number): string {
  return `${n} book${n === 1 ? "" : "s"}`;
}

// ---------- 1. Score ----------

function ScoreHistogramCard({ books }: { books: BookSummary[] }) {
  const [mode, setMode] = useState<"count" | "percent">("count");
  const data = useMemo(() => computeScoreHistogram(books), [books]);
  const totalScored = data.buckets.reduce((s, b) => s + b.count, 0);

  const valueOf = (b: Bucket) => (mode === "count" ? b.count : totalScored > 0 ? (b.count / totalScored) * 100 : 0);
  const formatValue = (v: number) => (mode === "count" ? countLabel(Math.round(v)) : `${v.toFixed(0)}%`);

  const markers: Marker[] = [];
  if (data.mean != null) markers.push({ label: `Mean ${data.mean.toFixed(2)}`, position: markerPosition(data.mean, SCORE_STEPS) });
  if (data.median != null)
    markers.push({ label: `Median ${data.median.toFixed(2)}`, position: markerPosition(data.median, SCORE_STEPS) });
  if (data.mode != null) markers.push({ label: `Mode ${data.mode.toFixed(1)}`, position: markerPosition(data.mode, SCORE_STEPS) });

  const caption =
    data.mean != null
      ? `Mean ${data.mean.toFixed(2)} · Median ${data.median?.toFixed(2)} · Mode ${data.mode?.toFixed(1)}`
      : null;

  const toggle = (
    <>
      <button type="button" onClick={() => setMode("count")} aria-pressed={mode === "count"} className={pillClass(mode === "count")}>
        Count
      </button>
      <button type="button" onClick={() => setMode("percent")} aria-pressed={mode === "percent"} className={pillClass(mode === "percent")}>
        Percentage
      </button>
    </>
  );

  return (
    <DistributionCard
      title="Score"
      buckets={data.buckets}
      orientation="vertical"
      valueOf={valueOf}
      formatValue={formatValue}
      drillValue={(b) => (b.score != null ? b.score.toFixed(1) : null)}
      markers={markers}
      caption={caption}
      toggle={toggle}
      excludedNote={excludedNoteFor(data.excluded, "no score")}
    />
  );
}

// ---------- 2. Book length ----------

function BookLengthCard({ books }: { books: BookSummary[] }) {
  const [mode, setMode] = useState<"words" | "pages">("words");
  const data = useMemo(() => computeLengthHistogram(books, mode), [books, mode]);

  const valueOf = (b: Bucket) => b.count;
  const formatValue = (v: number) => countLabel(v);
  const drillValue = (b: BookSummary) =>
    mode === "words"
      ? b.word_count != null
        ? `${Math.round(b.word_count).toLocaleString()} words`
        : null
      : `${b.page_count} pages`;

  const fmtLen = (n: number) => (mode === "words" ? `${Math.round(n).toLocaleString()} words` : `${Math.round(n)} pages`);
  const caption =
    data.mean != null
      ? `Mean ${fmtLen(data.mean)} · Shortest ${data.shortest ? data.shortest.title : "--"} · Longest ${
          data.longest ? data.longest.title : "--"
        }`
      : null;

  const toggle = (
    <>
      <button type="button" onClick={() => setMode("words")} aria-pressed={mode === "words"} className={pillClass(mode === "words")}>
        Words
      </button>
      <button type="button" onClick={() => setMode("pages")} aria-pressed={mode === "pages"} className={pillClass(mode === "pages")}>
        Pages
      </button>
    </>
  );

  return (
    <DistributionCard
      title="Book length"
      buckets={data.buckets}
      orientation="vertical"
      valueOf={valueOf}
      formatValue={formatValue}
      drillValue={drillValue}
      caption={caption}
      toggle={toggle}
      excludedNote={excludedNoteFor(data.excluded, mode === "words" ? "no word count" : "no page count")}
    />
  );
}

// ---------- 3. Genre split ----------

type VolumeMode = "books" | "pages" | "words";

function volumeValueOf(mode: VolumeMode) {
  return (b: Bucket) => (mode === "books" ? b.count : mode === "pages" ? b.pages : b.words);
}
function volumeFormat(mode: VolumeMode) {
  return (v: number) =>
    mode === "books" ? countLabel(v) : mode === "pages" ? `${Math.round(v).toLocaleString()} pg` : `${Math.round(v).toLocaleString()} wd`;
}
function volumeDrillValue(mode: VolumeMode) {
  return (b: BookSummary) =>
    mode === "books"
      ? null
      : mode === "pages"
        ? `${b.page_count} pages`
        : b.word_count != null
          ? `${Math.round(b.word_count).toLocaleString()} words`
          : null;
}

function VolumeToggle({ mode, onChange }: { mode: VolumeMode; onChange: (m: VolumeMode) => void }) {
  return (
    <>
      {(["books", "pages", "words"] as VolumeMode[]).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} aria-pressed={mode === m} className={pillClass(mode === m)}>
          {m === "books" ? "Books" : m === "pages" ? "Pages" : "Words"}
        </button>
      ))}
    </>
  );
}

function GenreSplitCard({ books, allGenres }: { books: BookSummary[]; allGenres: string[] }) {
  const [mode, setMode] = useState<VolumeMode>("books");
  const [showAll, setShowAll] = useState(false);
  const data = useMemo(() => computeGenreSplit(books, allGenres), [books, allGenres]);
  const shownBuckets = showAll ? data.buckets : data.buckets.filter((b) => b.count > 0);

  const toggle = (
    <>
      <VolumeToggle mode={mode} onChange={setMode} />
      <button type="button" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll} className={pillClass(showAll)}>
        {showAll ? "Hide empty" : "Show all"}
      </button>
    </>
  );

  return (
    <DistributionCard
      title="Genre split"
      buckets={shownBuckets}
      orientation="horizontal"
      valueOf={volumeValueOf(mode)}
      formatValue={volumeFormat(mode)}
      drillValue={volumeDrillValue(mode)}
      toggle={toggle}
      excludedNote={excludedNoteFor(data.excluded, "no genre")}
    />
  );
}

// ---------- 4. Format split ----------

function FormatSplitCard({ books }: { books: BookSummary[] }) {
  const [mode, setMode] = useState<VolumeMode>("books");
  const data = useMemo(() => computeFormatSplit(books), [books]);

  const toggle = <VolumeToggle mode={mode} onChange={setMode} />;

  return (
    <DistributionCard
      title="Format split"
      buckets={data.buckets}
      orientation="horizontal"
      valueOf={volumeValueOf(mode)}
      formatValue={volumeFormat(mode)}
      drillValue={volumeDrillValue(mode)}
      toggle={toggle}
      excludedNote={excludedNoteFor(data.excluded, "no format")}
    />
  );
}

// ---------- 5. Publication era ----------

function PublicationEraCard({ books }: { books: BookSummary[] }) {
  const data = useMemo(() => computePublicationEra(books), [books]);

  return (
    <DistributionCard
      title="Publication era"
      buckets={data.buckets}
      orientation="vertical"
      valueOf={(b) => b.count}
      formatValue={(v) => countLabel(v)}
      drillValue={(b) => (b.year_released != null ? String(b.year_released) : null)}
      excludedNote={excludedNoteFor(data.excluded, "no publication year")}
    />
  );
}

// ---------- 6. Reading pace ----------

// Matches distributionMath.ts's PACE_BUCKETS boundaries -- used only to
// place the mean marker within the (unevenly-spaced) bucket it falls in.
const PACE_BOUNDARIES = [20, 40, 60, 80, 100, Infinity];

function PaceHistogramCard({ books }: { books: BookSummary[] }) {
  const data = useMemo(() => computePaceHistogram(books), [books]);

  const markers: Marker[] = [];
  if (data.mean != null) {
    const idx = PACE_BOUNDARIES.findIndex((max) => data.mean! < max);
    markers.push({ label: `Mean ${data.mean.toFixed(1)} pg/day`, position: idx >= 0 ? idx : data.buckets.length - 1 });
  }
  const caption = data.mean != null ? `Your overall average: ${data.mean.toFixed(1)} pg/day` : null;

  return (
    <DistributionCard
      title="Reading pace"
      buckets={data.buckets}
      orientation="vertical"
      valueOf={(b) => b.count}
      formatValue={(v) => countLabel(v)}
      drillValue={(b) => (b.avg_pages_per_day != null ? `${b.avg_pages_per_day.toFixed(1)} pg/day` : null)}
      markers={markers}
      caption={caption}
      excludedNote={excludedNoteFor(data.excluded, "no tracked pace")}
    />
  );
}

// ---------- 7. Days to finish ----------

function DaysToFinishCard({ books }: { books: BookSummary[] }) {
  const data = useMemo(() => computeDaysToFinishHistogram(books), [books]);

  return (
    <DistributionCard
      title="Days to finish"
      buckets={data.buckets}
      orientation="vertical"
      valueOf={(b) => b.count}
      formatValue={(v) => countLabel(v)}
      drillValue={(b) => {
        if (!b.date_started || !b.date_finished) return null;
        const days = daysBetweenInclusive(b.date_started, b.date_finished);
        return `${days} day${days === 1 ? "" : "s"}`;
      }}
      excludedNote={excludedNoteFor(data.excluded, "no start/finish dates")}
    />
  );
}

// ---------- Section ----------
// Avg pages/day by format, Books finished per month, and Words per month
// used to live here as small DistributionCard tiles -- moved out to their
// own full-size sections (PagesPerDaySection, MonthlyVolumeSection)
// with real hover tooltips, since a 2-bar average and a small bar chart
// hid too much (per-book variation, drill-down detail) to be useful.

export function DistributionsSection({
  books,
  allGenres,
  scope,
}: {
  books: BookSummary[];
  allGenres: string[];
  scope: Scope;
}) {
  // Same "only actually-finished books count" rule as Leaderboards.
  const scopedBooks = useMemo(
    () => books.filter((b) => b.date_finished != null && (scope.kind === "all" || b.year_read === scope.year)),
    [books, scope]
  );

  return (
    <SectionShell title="Distributions">
      <div className="grid gap-4 md:grid-cols-2">
        <ScoreHistogramCard books={scopedBooks} />
        <BookLengthCard books={scopedBooks} />
        <GenreSplitCard books={scopedBooks} allGenres={allGenres} />
        <FormatSplitCard books={scopedBooks} />
        <PublicationEraCard books={scopedBooks} />
        <PaceHistogramCard books={scopedBooks} />
        <DaysToFinishCard books={scopedBooks} />
        <RatingByGenreCard books={scopedBooks} />
      </div>
    </SectionShell>
  );
}
