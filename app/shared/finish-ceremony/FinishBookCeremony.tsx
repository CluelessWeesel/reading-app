"use client";

import { useState } from "react";
import type { Book } from "../bookTypes";
import { CardPromptsStep } from "./CardPromptsStep";
import { ClosingScreen } from "./ClosingScreen";
import { ConfirmDetailsStep } from "./ConfirmDetailsStep";
import { RadarRatingsStep } from "./RadarRatingsStep";
import { RankingPlacementStep } from "./RankingPlacementStep";
import { ScoreStep } from "./ScoreStep";
import { WrittenReviewStep } from "./WrittenReviewStep";

type Step = "confirm" | "score" | "radar" | "ranking" | "review" | "prompts" | "closing";

const CONTENT_STEPS: Step[] = ["confirm", "score", "radar", "ranking", "review", "prompts"];
// +1 so the progress bar counts the closing screen as the final step of the 7 the user experiences.
const TOTAL_STEPS = CONTENT_STEPS.length + 1;

type ClosingData = {
  yearRead: number;
  yearTotals: { books: number; pages: number };
};

export function FinishBookCeremony({
  book: initialBook,
  onClose,
  onFinished,
}: {
  book: Book;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [step, setStep] = useState<Step>("confirm");
  const [book, setBook] = useState(initialBook);
  const [ranking, setRanking] = useState<{ rank: number; year: number } | null>(null);
  const [closingData, setClosingData] = useState<ClosingData | null>(null);

  const stepIndex = CONTENT_STEPS.indexOf(step);

  function goTo(next: Step) {
    setStep(next);
  }

  async function handleFinish() {
    const res = await fetch(`/api/finish-book/${book.book_id}`, { method: "POST" });
    const data = await res.json();
    setClosingData({ yearRead: data.year_read, yearTotals: data.year_totals });
    setStep("closing");
    const finishedBook: Book = {
      ...book,
      status: "read",
      year_read: data.year_read,
      date_finished: data.date_finished,
    };
    setBook(finishedBook);
    window.dispatchEvent(new Event("current-books:changed"));
    window.dispatchEvent(new CustomEvent("book:finished", { detail: finishedBook }));
  }

  function handleDone() {
    onFinished();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4">
      <div className="relative flex min-h-full w-full max-w-2xl flex-col overflow-hidden bg-paper shadow-lg sm:max-h-[85vh] sm:min-h-0 sm:rounded-xl">
        {step !== "closing" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 rounded-full px-2 py-1 text-ink-faint hover:bg-hover hover:text-ink"
          >
            ✕
          </button>
        )}

        {step === "confirm" && (
          <ConfirmDetailsStep
            book={book}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onNext={(updated) => {
              setBook(updated);
              goTo("score");
            }}
          />
        )}
        {step === "score" && (
          <ScoreStep
            book={book}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onNext={(updated) => {
              setBook(updated);
              goTo("radar");
            }}
            onSkip={() => goTo("radar")}
            onBack={() => goTo("confirm")}
          />
        )}
        {step === "radar" && (
          <RadarRatingsStep
            book={book}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onNext={() => goTo("ranking")}
            onSkip={() => goTo("ranking")}
            onBack={() => goTo("score")}
          />
        )}
        {step === "ranking" && (
          <RankingPlacementStep
            book={book}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onNext={(rank, year) => {
              setRanking({ rank, year });
              goTo("review");
            }}
            onSkip={() => {
              setRanking(null);
              goTo("review");
            }}
            onBack={() => goTo("radar")}
          />
        )}
        {step === "review" && (
          <WrittenReviewStep
            book={book}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onNext={(updated) => {
              setBook(updated);
              goTo("prompts");
            }}
            onSkip={() => goTo("prompts")}
            onBack={() => goTo("ranking")}
          />
        )}
        {step === "prompts" && (
          <CardPromptsStep
            book={book}
            stepIndex={stepIndex}
            totalSteps={TOTAL_STEPS}
            onFinish={handleFinish}
            onBack={() => goTo("review")}
          />
        )}
        {step === "closing" && closingData && (
          <ClosingScreen
            book={book}
            ranking={ranking}
            yearTotals={closingData.yearTotals}
            yearRead={closingData.yearRead}
            totalSteps={TOTAL_STEPS}
            onDone={handleDone}
          />
        )}
      </div>
    </div>
  );
}
