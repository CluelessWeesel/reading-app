import { WidgetCard } from "./WidgetCard";
import { formatPagesK } from "../../stats/statsMath";
import type { YearAtDay } from "../amongYearsMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <rect x="3" y="10" width="3" height="7" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
    <rect x="8.5" y="6" width="3" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
    <rect x="14" y="3" width="3" height="14" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export function AmongTheYearsWidget({ years, currentYear }: { years: YearAtDay[] | null; currentYear: number }) {
  if (!years) return null;

  const max = Math.max(...years.map((y) => y.pages), 1);

  return (
    <WidgetCard title={`${currentYear} among the years`} accent="blue" icon={ICON}>
      <div className="space-y-2.5">
        {years.map((y) => (
          <div key={y.year} className="flex items-center gap-3">
            <span className={`w-10 shrink-0 text-xs tabular-nums ${y.isCurrent ? "font-semibold text-ink-warm" : "text-ink-warm-faint"}`}>
              {y.year}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(y.pages / max) * 100}%`,
                  backgroundColor: "var(--accent-blue)",
                  opacity: y.isCurrent ? 1 : 0.35,
                  boxShadow: y.isCurrent ? "0 0 8px var(--accent-blue)" : undefined,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-warm-faint">
              {formatPagesK(y.pages)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-warm-faint">Same calendar day each year.</p>
    </WidgetCard>
  );
}

AmongTheYearsWidget.size = "feature" as const;
