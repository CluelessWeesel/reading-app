"use client";

import { useState } from "react";
import { fraunces } from "../shared/fonts";
import { BackfillTab } from "./BackfillTab";
import { EditTab } from "./EditTab";
import { TonightTab } from "./TonightTab";
import type { CurrentBookForLog, DailyReadingRow } from "./types";

type Tab = "tonight" | "backfill" | "edit";

const TABS: { key: Tab; label: string }[] = [
  { key: "tonight", label: "Tonight" },
  { key: "backfill", label: "Backfill" },
  { key: "edit", label: "Edit" },
];

export function LogView({
  currentBooks: initialCurrentBooks,
  recentRows,
}: {
  currentBooks: CurrentBookForLog[];
  recentRows: DailyReadingRow[];
}) {
  const [tab, setTab] = useState<Tab>("tonight");
  const [currentBooks, setCurrentBooks] = useState(initialCurrentBooks);

  function handleCoverChange(bookId: number, coverUrl: string | null) {
    setCurrentBooks((prev) => prev.map((b) => (b.book_id === bookId ? { ...b, cover_url: coverUrl } : b)));
  }

  function handleBooksUpdated(
    updates: { book_id: number; position: number; last_log_date: string }[]
  ) {
    setCurrentBooks((prev) =>
      prev.map((b) => {
        const u = updates.find((x) => x.book_id === b.book_id);
        return u ? { ...b, position: u.position, last_log_date: u.last_log_date } : b;
      })
    );
  }

  function handlePositionUpdated(bookId: number, position: number) {
    setCurrentBooks((prev) => prev.map((b) => (b.book_id === bookId ? { ...b, position } : b)));
  }

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        <h1 className={`${fraunces.className} mb-4 text-3xl font-semibold text-ink`}>Log</h1>

        <div className="mb-6 flex gap-1 rounded-full border border-hairline bg-card/70 p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`flex-1 rounded-full py-2 text-sm transition ${
                tab === t.key ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "tonight" && (
          <TonightTab
            currentBooks={currentBooks}
            onBooksUpdated={handleBooksUpdated}
            onCoverChange={handleCoverChange}
          />
        )}
        {tab === "backfill" && (
          <BackfillTab
            currentBooks={currentBooks}
            onBooksUpdated={handleBooksUpdated}
            onCoverChange={handleCoverChange}
          />
        )}
        {tab === "edit" && <EditTab initialRows={recentRows} onPositionUpdated={handlePositionUpdated} />}
      </div>
    </div>
  );
}
