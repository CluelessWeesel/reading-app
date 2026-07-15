"use client";

import { useState } from "react";
import { addIsoDays, todayLocalIso } from "../shared/isoDate";
import { BackfillForm } from "./BackfillForm";
import type { CurrentBookForLog } from "./types";

export function BackfillTab({
  currentBooks,
  onBooksUpdated,
  onCoverChange,
}: {
  currentBooks: CurrentBookForLog[];
  onBooksUpdated: (updates: { book_id: number; position: number; last_log_date: string }[]) => void;
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
}) {
  const yesterday = addIsoDays(todayLocalIso(), -1);
  const [targetDate, setTargetDate] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="backfill-date">
          Date to fill in
        </label>
        <input
          id="backfill-date"
          type="date"
          max={yesterday}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full rounded-lg border border-hairline bg-card px-4 py-3 text-lg text-ink outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {targetDate && (
        <BackfillForm
          key={targetDate}
          targetDate={targetDate}
          currentBooks={currentBooks}
          onBooksUpdated={onBooksUpdated}
          onCoverChange={onCoverChange}
        />
      )}
    </div>
  );
}
