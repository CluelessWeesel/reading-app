"use client";

import { useMemo, useState } from "react";
import { fraunces } from "../shared/fonts";
import { InfoTooltip } from "../shared/InfoTooltip";
import { RecordCard } from "./RecordCard";
import { RECORD_GROUPS, computeBirthdayRead, computeOpenerCloser } from "./recordsMath";
import type { RecordContext, RecordSpec } from "./recordsMath";
import { SectionShell } from "./SectionShell";
import { scopeDateRange } from "./statsMath";
import type { BookSummary, DailyRow, FormatDailyRow, Scope, TbrEntry } from "./types";

function BirthdayReadCard({
  books,
  scope,
  currentYear,
  birthdayMMDD,
  onSaveSetting,
}: {
  books: BookSummary[];
  scope: Scope;
  currentYear: number;
  birthdayMMDD: string | null;
  onSaveSetting: (key: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(birthdayMMDD ?? "");
  const [saving, setSaving] = useState(false);

  const year = scope.kind === "year" ? scope.year : currentYear;
  const result = useMemo(() => computeBirthdayRead(books, year, birthdayMMDD), [books, year, birthdayMMDD]);

  async function handleSave() {
    if (!/^\d{2}-\d{2}$/.test(draft)) return;
    setSaving(true);
    try {
      await onSaveSetting("birthday", draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const description = "Whatever book was in progress on your birthday. Set the date once below (no year needed).";

  return (
    <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">The Birthday Read</p>
        <InfoTooltip text={description} />
      </div>
      {!birthdayMMDD ? (
        editing ? (
          <span className="mt-1 inline-flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="MM-DD"
              className="w-16 rounded border border-gold bg-surface-1 px-1.5 py-0.5 text-xs text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button type="button" onClick={handleSave} disabled={saving} className="text-xs text-accent underline decoration-dotted underline-offset-4 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
          >
            Set your birthday
          </button>
        )
      ) : result.ok ? (
        <>
          <p className={`${fraunces.className} truncate text-sm font-semibold text-ink-warm`}>
            <a href={result.holderHref} className="hover:underline">
              {result.holder}
            </a>
          </p>
          <p className="truncate text-xs text-ink-warm-faint">{result.value}</p>
        </>
      ) : (
        <p className="mt-1 text-xs text-ink-warm-faint">Not enough data yet.</p>
      )}
    </div>
  );
}

function OpenerCloserCards({ books, allBooks, isYearScope }: { books: BookSummary[]; allBooks: BookSummary[]; isYearScope: boolean }) {
  const current = useMemo(() => computeOpenerCloser(books), [books]);
  const allTime = useMemo(() => computeOpenerCloser(allBooks), [allBooks]);
  return (
    <>
      <RecordCard
        label="The Opener"
        description="The first book finished in scope."
        current={current.opener}
        allTime={isYearScope ? allTime.opener : null}
      />
      <RecordCard
        label="The Closer"
        description="The last book finished in scope."
        current={current.closer}
        allTime={isYearScope ? allTime.closer : null}
      />
    </>
  );
}

export function RecordsSection({
  books,
  dailyRows,
  formatDailyRows,
  tbrEntries,
  appSettings,
  onSaveSetting,
  scope,
  currentYear,
}: {
  books: BookSummary[];
  dailyRows: DailyRow[];
  formatDailyRows: FormatDailyRow[];
  tbrEntries: TbrEntry[];
  appSettings: Record<string, string>;
  onSaveSetting: (key: string, value: string) => Promise<void>;
  scope: Scope;
  currentYear: number;
}) {
  const today = dailyRows.length > 0 ? dailyRows[dailyRows.length - 1].date : `${currentYear}-01-01`;
  const { start, end } = scopeDateRange(scope, today, currentYear);
  const isYearScope = scope.kind === "year";
  const birthdayMMDD = appSettings.birthday || null;

  // Only actually-finished books count -- same rule as Leaderboards/Distributions.
  const scopedBooks = useMemo(
    () => books.filter((b) => b.date_finished != null && (scope.kind === "all" || b.year_read === scope.year)),
    [books, scope]
  );
  const allTimeBooks = useMemo(() => books.filter((b) => b.date_finished != null), [books]);

  const scopedDailyRows = useMemo(() => dailyRows.filter((r) => r.date >= start && r.date <= end), [dailyRows, start, end]);
  const scopedFormatRows = useMemo(
    () => formatDailyRows.filter((r) => r.date >= start && r.date <= end),
    [formatDailyRows, start, end]
  );

  const currentContext: RecordContext = useMemo(
    () => ({
      books: scopedBooks,
      dailyRows: scopedDailyRows,
      formatDailyRows: scopedFormatRows,
      tbrEntries,
      birthdayMMDD,
      year: isYearScope ? (scope as { kind: "year"; year: number }).year : null,
      start,
      end,
    }),
    [scopedBooks, scopedDailyRows, scopedFormatRows, tbrEntries, birthdayMMDD, isYearScope, scope, start, end]
  );

  const allTimeContext: RecordContext = useMemo(
    () => ({
      books: allTimeBooks,
      dailyRows,
      formatDailyRows,
      tbrEntries,
      birthdayMMDD,
      year: null,
      start: "2023-01-01",
      end: today,
    }),
    [allTimeBooks, dailyRows, formatDailyRows, tbrEntries, birthdayMMDD, today]
  );

  function renderSpec(spec: RecordSpec) {
    const current = spec.compute(spec.allTimeOnly ? allTimeContext : currentContext);
    const allTime = !spec.allTimeOnly && isYearScope ? spec.compute(allTimeContext) : null;
    return <RecordCard key={spec.key} label={spec.label} description={spec.description} current={current} allTime={allTime} />;
  }

  return (
    <SectionShell title="Records">
      {RECORD_GROUPS.map((group) => (
        <div key={group.title} className="mb-6 last:mb-0">
          <div className="mb-2 flex items-center gap-1.5">
            <span aria-hidden>{group.emoji}</span>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-warm-faint">{group.title}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.title === "Time" ? (
              <>
                {renderSpec(group.records.find((r) => r.key === "harvest-month")!)}
                <OpenerCloserCards books={scopedBooks} allBooks={allTimeBooks} isYearScope={isYearScope} />
                {renderSpec(group.records.find((r) => r.key === "new-years-discipline")!)}
                <BirthdayReadCard
                  books={allTimeBooks}
                  scope={scope}
                  currentYear={currentYear}
                  birthdayMMDD={birthdayMMDD}
                  onSaveSetting={onSaveSetting}
                />
              </>
            ) : (
              group.records.map(renderSpec)
            )}
          </div>
        </div>
      ))}
    </SectionShell>
  );
}
