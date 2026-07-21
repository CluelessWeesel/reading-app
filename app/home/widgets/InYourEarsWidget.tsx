import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { InYourEars } from "../inYourEarsMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M6 10a4 4 0 0 1 8 0v3a2 2 0 0 1-2 2h-1v-5h3M6 13v-3h3v5H7a2 2 0 0 1-2-2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export function InYourEarsWidget({ inYourEars }: { inYourEars: InYourEars | null }) {
  if (!inYourEars) return null;

  return (
    <WidgetCard title="In your ears" accent="violet" icon={ICON}>
      <p className="text-xl font-semibold tabular-nums text-accent-violet">{inYourEars.hoursThisYear.toFixed(0)}h</p>
      <p className="mt-1 text-[11px] text-ink-warm-faint">
        this year -- {inYourEars.hoursAllTime.toFixed(0)}h all-time
      </p>
      {inYourEars.topNarrator && (
        <p className="mt-1 text-[11px] text-ink-warm-faint">
          Most this year:{" "}
          <Link href={`/narrators/${inYourEars.topNarrator.narratorId}`} className="text-ink-warm hover:underline">
            {inYourEars.topNarrator.name}
          </Link>
        </p>
      )}
    </WidgetCard>
  );
}

InYourEarsWidget.size = "feature" as const;
