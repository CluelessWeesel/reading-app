"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PreflightBoard } from "./PreflightBoard";
import { RevealStage } from "./RevealStage";
import { ClosingSummary } from "./ClosingSummary";
import type { WeeselCategory } from "../../types";
import type { AuthorOption, CategoryStatus, EligibleCandidate, WatchedSuggestion, YearFinishedBook } from "../types";

export type CeremonyCategoryData = {
  category: WeeselCategory;
  status: CategoryStatus;
  computedPool: EligibleCandidate[];
  watchedSuggestions: WatchedSuggestion[];
  isManualPick: boolean;
};

export function CeremonyView({
  year,
  categoryData,
  yearBooks,
  allAuthors,
}: {
  year: number;
  categoryData: CeremonyCategoryData[];
  yearBooks: YearFinishedBook[];
  allAuthors: AuthorOption[];
}) {
  const router = useRouter();
  const [viewCategoryId, setViewCategoryId] = useState<number | null>(null);

  function refresh() {
    router.refresh();
  }

  const preflightDone = categoryData.every((c) => c.status.state !== "unreviewed");

  const runningCategories = categoryData.filter(
    (c) => c.status.state === "confirmed-running" || c.status.state === "revealed"
  );

  const firstUnrevealedIndex = runningCategories.findIndex((c) => c.status.state === "confirmed-running");
  const naturalIndex = firstUnrevealedIndex === -1 ? runningCategories.length - 1 : firstUnrevealedIndex;
  const ceremonyComplete = preflightDone && runningCategories.length > 0 && firstUnrevealedIndex === -1;

  const activeIndex = useMemo(() => {
    if (viewCategoryId != null) {
      const idx = runningCategories.findIndex((c) => c.category.id === viewCategoryId);
      if (idx !== -1) return idx;
    }
    return naturalIndex;
  }, [viewCategoryId, runningCategories, naturalIndex]);

  if (!preflightDone) {
    return (
      <PreflightBoard
        year={year}
        categoryData={categoryData}
        yearBooks={yearBooks}
        allAuthors={allAuthors}
        onConfirmed={refresh}
      />
    );
  }

  if (runningCategories.length === 0 || ceremonyComplete) {
    return <ClosingSummary year={year} runningCategories={runningCategories} onSealed={refresh} />;
  }

  const current = runningCategories[activeIndex];
  const revealedCount = runningCategories.filter((c) => c.status.state === "revealed").length;

  return (
    <RevealStage
      year={year}
      data={current}
      progress={{ revealed: revealedCount, total: runningCategories.length }}
      canGoBack={activeIndex > 0}
      canGoForward={activeIndex < naturalIndex}
      onBack={() => setViewCategoryId(runningCategories[activeIndex - 1]?.category.id ?? null)}
      onForward={() => setViewCategoryId(runningCategories[activeIndex + 1]?.category.id ?? null)}
      onChanged={() => {
        setViewCategoryId(null);
        refresh();
      }}
    />
  );
}
