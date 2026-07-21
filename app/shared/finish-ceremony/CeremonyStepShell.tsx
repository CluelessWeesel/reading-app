"use client";

import { fraunces } from "../fonts";
import { ProgressDots } from "./ProgressDots";

export function CeremonyStepShell({
  title,
  stepIndex,
  totalSteps,
  children,
  onNext,
  onSkip,
  onBack,
  nextLabel = "Next",
  nextDisabled = false,
}: {
  title: string;
  stepIndex: number;
  totalSteps: number;
  children: React.ReactNode;
  onNext: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-6 sm:py-10">
      <div className="mb-6 shrink-0">
        <div className="mb-3">
          <ProgressDots current={stepIndex} total={totalSteps} />
        </div>
        <h2 className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>{title}</h2>
      </div>

      {/* px-1 -mx-1 gives focus rings on full-width fields room so the scroll
          container's overflow-x (implicit from overflow-y-auto) doesn't clip them. */}
      <div className="-mx-1 flex-1 overflow-y-auto px-1">{children}</div>

      <div className="mt-6 flex shrink-0 items-center justify-between gap-4 border-t border-gold pt-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
            >
              Back
            </button>
          )}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
            >
              Skip
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="rounded-full bg-accent px-6 py-3 text-base font-semibold text-on-accent shadow-sm transition disabled:opacity-50"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
