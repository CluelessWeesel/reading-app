import { fraunces } from "../../shared/fonts";
import type { MonthGlanceCardData } from "../types";

function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-current/15 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-60">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ComparisonBar({
  label,
  leftLabel,
  leftPercent,
  rightLabel,
  rightPercent,
}: {
  label: string;
  leftLabel: string;
  leftPercent: number;
  rightLabel: string;
  rightPercent: number;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide opacity-60">{label}</p>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-current/10">
        <div style={{ width: `${leftPercent}%`, backgroundColor: "var(--accent-blue)" }} />
        <div style={{ width: `${rightPercent}%`, backgroundColor: "var(--accent-blue-chip)" }} />
      </div>
      <p className="mt-1 flex justify-between text-[10px] opacity-60">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </p>
    </div>
  );
}

// Every quick stat the month has -- TBR flow and Author of the Month used
// to live on their own three-up row alongside Records Corner; a month
// either has these quick stats or it doesn't, and splitting them across
// two cards left both feeling sparse. A comparison-bar footer turns the
// two proportion-shaped stats here (format split, TBR flow) into an actual
// chart instead of two more lines of text.
export function MonthGlanceCard({ card }: { card: MonthGlanceCardData }) {
  const slots = [
    card.pace && (
      <MiniStat key="pace" label="Pace">
        <p className={`${fraunces.className} text-xl font-semibold`}>{card.pace.avgPagesPerDay.toFixed(1)} pg/day</p>
        <p className="mt-0.5 text-[11px] opacity-70">{card.pace.longestStreak}-day streak this month</p>
      </MiniStat>
    ),
    card.balance && (
      <MiniStat key="balance" label="Balance">
        <p className={`${fraunces.className} text-xl font-semibold`}>{Math.round(card.balance.audioSharePercent)}% audio</p>
        <p className="mt-0.5 text-[11px] opacity-70">{card.balance.comparison}</p>
      </MiniStat>
    ),
    card.authorMover && (
      <MiniStat key="mover" label={card.authorMover.isFaller ? "Biggest faller" : "Author mover"}>
        <p className={`${fraunces.className} truncate text-base font-semibold`}>{card.authorMover.author}</p>
        <p className="mt-0.5 text-[11px] opacity-70">
          {card.authorMover.rankBefore} → {card.authorMover.rankAfter}
        </p>
      </MiniStat>
    ),
    card.predictions && (
      <MiniStat key="predictions" label="Predictions">
        <p className={`${fraunces.className} text-xl font-semibold`}>{card.predictions.resolvedCount} resolved</p>
        <p className="mt-0.5 text-[11px] opacity-70">Off by {card.predictions.avgAbsError.toFixed(2)} on average</p>
      </MiniStat>
    ),
    card.tbrFlow && (
      <MiniStat key="tbr" label="TBR flow">
        <p className={`${fraunces.className} text-xl font-semibold`}>
          +{card.tbrFlow.added} / -{card.tbrFlow.finished}
        </p>
        <p className="mt-0.5 text-[11px] opacity-70">{card.tbrFlow.verdict}</p>
      </MiniStat>
    ),
    card.authorOfMonth && (
      <MiniStat key="author-of-month" label="Author of the month">
        <p className={`${fraunces.className} truncate text-base font-semibold`}>{card.authorOfMonth.author}</p>
        <p className="mt-0.5 text-[11px] opacity-70">{card.authorOfMonth.pages.toLocaleString()} pages</p>
      </MiniStat>
    ),
  ].filter(Boolean);

  // A hardcoded column count leaves a lopsided empty half when only a
  // couple of slots have data (a quiet month with no author movement,
  // predictions, or TBR activity) -- sizing to what's actually present
  // avoids that.
  const columns = Math.min(2, Math.max(1, slots.length));

  const audioPercent = card.balance ? Math.round(card.balance.audioSharePercent) : null;
  const tbrTotal = card.tbrFlow ? card.tbrFlow.added + card.tbrFlow.finished : 0;

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">This month, at a glance</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {slots}
      </div>

      {(audioPercent != null || tbrTotal > 0) && (
        <div className="space-y-3 border-t border-current/15 pt-4">
          {audioPercent != null && (
            <ComparisonBar
              label="Format"
              leftLabel={`Physical ${100 - audioPercent}%`}
              leftPercent={100 - audioPercent}
              rightLabel={`Audio ${audioPercent}%`}
              rightPercent={audioPercent}
            />
          )}
          {card.tbrFlow && tbrTotal > 0 && (
            <ComparisonBar
              label="TBR flow"
              leftLabel={`Added ${card.tbrFlow.added}`}
              leftPercent={(card.tbrFlow.added / tbrTotal) * 100}
              rightLabel={`Finished ${card.tbrFlow.finished}`}
              rightPercent={(card.tbrFlow.finished / tbrTotal) * 100}
            />
          )}
        </div>
      )}
    </div>
  );
}
