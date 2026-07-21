import Link from "next/link";
import { fraunces } from "../shared/fonts";
import { formatDateShort } from "../shared/formatDateShort";
import { InfoTooltip } from "../shared/InfoTooltip";
import type { RecordResult } from "./recordsMath";

// The one reusable card behind every /stats record: a playful label, the
// holder (linked when it's a book), a precise value, and -- for a
// single-year scope -- the all-time record whispered beneath in muted text.
// Adding a future record is just another RecordSpec in recordsMath.ts; this
// component doesn't change.
export function RecordCard({
  label,
  description,
  current,
  allTime,
}: {
  label: string;
  description?: string;
  current: RecordResult;
  allTime?: RecordResult | null;
}) {
  return (
    <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
        {description && <InfoTooltip text={description} />}
      </div>
      {current.ok ? (
        <>
          <p className={`${fraunces.className} truncate text-sm font-semibold text-ink-warm`}>
            {current.holderHref ? (
              <Link href={current.holderHref} className="hover:underline">
                {current.holder}
              </Link>
            ) : (
              current.holder
            )}
          </p>
          <p className="truncate text-xs text-ink-warm-faint">
            {current.value}
            {current.when ? ` · ${formatDateShort(current.when)}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-ink-warm-faint">Not enough data yet.</p>
      )}

      {allTime && allTime.ok && (
        <p className="mt-1.5 truncate text-[10px] text-ink-warm-faint/70">
          All-time: {allTime.holder} · {allTime.value}
        </p>
      )}
    </div>
  );
}
