"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { fraunces } from "../shared/fonts";
import { DailyLogSection } from "./DailyLogSection";
import { DistributionsSection } from "./DistributionsSection";
import { LeaderboardsSection } from "./LeaderboardsSection";
import { MonthlyVolumeSection } from "./MonthlyVolumeSection";
import { PaceSection } from "./PaceSection";
import { PagesPerDaySection } from "./PagesPerDaySection";
import { ProjectionSection } from "./ProjectionSection";
import { PublicationScatterSection } from "./PublicationScatterSection";
import { RecordsSection } from "./RecordsSection";
import { buildYearSeriesByDayOfYear, computeScopeData } from "./statsMath";
import type { BookSummary, DailyRow, FormatDailyRow, Goal, Scope, SeriesParent, TbrEntry } from "./types";

export function StatsView({
  dailyRows,
  formatDailyRows,
  books,
  goals: initialGoals,
  seriesParents,
  allGenres,
  tbrEntries,
  appSettings: initialAppSettings,
  today,
  currentYear,
  years,
}: {
  dailyRows: DailyRow[];
  formatDailyRows: FormatDailyRow[];
  books: BookSummary[];
  goals: Goal[];
  seriesParents: SeriesParent[];
  allGenres: string[];
  tbrEntries: TbrEntry[];
  appSettings: Record<string, string>;
  today: string;
  currentYear: number;
  years: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [goals, setGoals] = useState(initialGoals);
  const [appSettings, setAppSettings] = useState(initialAppSettings);
  const [scope, setScope] = useState<Scope>({ kind: "year", year: currentYear });
  const [view, setView] = useState<"graphs" | "boards" | "daily">(() => {
    const v = searchParams.get("view");
    return v === "boards" || v === "daily" ? v : "graphs";
  });

  function changeView(v: "graphs" | "boards" | "daily") {
    setView(v);
    const params = new URLSearchParams(searchParams.toString());
    if (v === "graphs") params.delete("view");
    else params.set("view", v);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const scopeData = useMemo(
    () => computeScopeData({ scope, today, currentYear, dailyRows, formatDailyRows, books, goals }),
    [scope, today, currentYear, dailyRows, formatDailyRows, books, goals]
  );

  // Only computed/shown when viewing the current year -- day-of-year-indexed
  // so each prior year's curve lines up with the current year's own x-axis.
  const priorYearSeries = useMemo(() => {
    return years
      .filter((y) => y < currentYear)
      .map((y) => ({ year: y, points: buildYearSeriesByDayOfYear(dailyRows, y) }))
      .filter((s) => s.points.some((p) => p.y > 0));
  }, [years, currentYear, dailyRows]);

  async function handleSaveGoal(year: number, pagesGoal: number) {
    const res = await fetch("/api/reading-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, pages_goal: pagesGoal }),
    });
    if (!res.ok) throw new Error("Failed to save goal.");
    setGoals((prev) => {
      const exists = prev.some((g) => g.year === year);
      return exists
        ? prev.map((g) => (g.year === year ? { year, pages_goal: pagesGoal } : g))
        : [...prev, { year, pages_goal: pagesGoal }];
    });
  }

  async function handleSaveSetting(key: string, value: string) {
    const res = await fetch("/api/app-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error("Failed to save.");
    setAppSettings((prev) => ({ ...prev, [key]: value }));
  }

  const scopeKey = scope.kind === "all" ? "all" : String(scope.year);

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>Stats</h1>
        </header>

        <div className="mb-2 flex flex-wrap gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setScope({ kind: "year", year: y })}
              aria-pressed={scope.kind === "year" && scope.year === y}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                scope.kind === "year" && scope.year === y
                  ? "bg-accent text-on-accent"
                  : "border border-hairline bg-card/70 text-ink-muted hover:bg-hover"
              }`}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setScope({ kind: "all" })}
            aria-pressed={scope.kind === "all"}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              scope.kind === "all"
                ? "bg-accent text-on-accent"
                : "border border-hairline bg-card/70 text-ink-muted hover:bg-hover"
            }`}
          >
            All time
          </button>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => changeView("graphs")}
            aria-pressed={view === "graphs"}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              view === "graphs"
                ? "border-accent bg-accent text-on-accent shadow-sm"
                : "border-hairline bg-card/70 text-ink-muted hover:bg-hover"
            }`}
          >
            Graphs
          </button>
          <button
            type="button"
            onClick={() => changeView("boards")}
            aria-pressed={view === "boards"}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              view === "boards"
                ? "border-accent bg-accent text-on-accent shadow-sm"
                : "border-hairline bg-card/70 text-ink-muted hover:bg-hover"
            }`}
          >
            Boards & Records
          </button>
          <button
            type="button"
            onClick={() => changeView("daily")}
            aria-pressed={view === "daily"}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              view === "daily"
                ? "border-accent bg-accent text-on-accent shadow-sm"
                : "border-hairline bg-card/70 text-ink-muted hover:bg-hover"
            }`}
          >
            Daily Log
          </button>
        </div>

        {view === "graphs" && (
          <>
            <PaceSection
              key={scopeKey}
              data={scopeData}
              isCurrentYear={scope.kind === "year" && scope.year === currentYear}
              priorYearSeries={priorYearSeries}
              onSaveGoal={handleSaveGoal}
            />

            <ProjectionSection dailyRows={dailyRows} years={years} currentYear={currentYear} today={today} scope={scope} />

            <DistributionsSection books={books} allGenres={allGenres} scope={scope} />

            <PagesPerDaySection books={books} scope={scope} />

            <MonthlyVolumeSection books={books} scope={scope} today={today} currentYear={currentYear} />

            <PublicationScatterSection books={books} scope={scope} today={today} currentYear={currentYear} />

            {/* Future graphs get appended here. */}
          </>
        )}

        {view === "boards" && (
          <>
            <LeaderboardsSection books={books} seriesParents={seriesParents} scope={scope} />

            <RecordsSection
              books={books}
              dailyRows={dailyRows}
              formatDailyRows={formatDailyRows}
              tbrEntries={tbrEntries}
              appSettings={appSettings}
              onSaveSetting={handleSaveSetting}
              scope={scope}
              currentYear={currentYear}
            />
          </>
        )}

        {view === "daily" && <DailyLogSection dailyRows={dailyRows} today={today} currentYear={currentYear} scope={scope} />}
      </div>
    </div>
  );
}
