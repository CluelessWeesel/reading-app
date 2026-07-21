import { WidgetCard } from "./WidgetCard";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M6 14 C4 14 3 12.5 3 10.5 C3 8 5 6 7.5 6 C7.5 4 9 3 10.5 3 C13 3 15 5 15 7.5 C16.5 7.8 17.5 9 17.5 10.5 C17.5 12.5 16 14 14 14 Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

// Fills the third slot beside On This Day/Anniversaries -- unlike those
// two (which need an exact-ish calendar match and can still come up empty
// some days even with a window), this is a standing meta-stat about your
// own reflection habits, so it's reliably there whenever any prompts have
// been answered at all.
export function FavoritePromptWidget({ prompt }: { prompt: { question: string; count: number } | null }) {
  if (!prompt) return null;

  return (
    <WidgetCard title="Favourite prompt" accent="purple" icon={ICON} compact>
      <p className="text-xs text-ink-warm-faint">
        You&apos;ve answered <span className="font-semibold text-ink-warm">&ldquo;{prompt.question}&rdquo;</span>{" "}
        <span className="font-semibold text-accent-purple">{prompt.count}</span> time{prompt.count === 1 ? "" : "s"}
      </p>
    </WidgetCard>
  );
}

FavoritePromptWidget.size = "micro" as const;
