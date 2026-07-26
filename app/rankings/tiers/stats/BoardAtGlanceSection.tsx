import { fraunces } from "@/app/shared/fonts";
import { InfoTooltip } from "@/app/shared/InfoTooltip";
import { TIER_BG_CLASS, tierLabel } from "../tierColors";
import type { BoardAtGlance } from "./boardAtGlanceMath";

export function BoardAtGlanceSection({ data }: { data: BoardAtGlance }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <h3 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Capacity, tier by tier</h3>
          <InfoTooltip text="How full each tier is against its capacity. Capacities are set as a PERCENTAGE of the judged (non-Holding) placed total, not a fixed count -- so a tier's numeric capacity grows as the library grows, and Holding's size never inflates it. 'Full' just means that tier is at its current share." />
        </div>
        <div className="space-y-2.5">
          {data.tiers.map((t) => (
            <div key={t.tier} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-sm font-semibold uppercase text-ink-warm">{tierLabel(t.tier)}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-hairline">
                <span
                  className={`block h-full rounded-full ${t.full ? "bg-accent-coral" : TIER_BG_CLASS[t.tier]} opacity-80`}
                  style={{ width: `${Math.min(t.pctFull, 1) * 100}%` }}
                />
              </span>
              <span className={`w-16 shrink-0 text-right text-xs ${t.full ? "font-medium text-accent-coral" : "text-ink-warm-faint"}`}>
                {t.count} / {t.capacity}
                {t.full ? " full" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Holding backlog</p>
            <InfoTooltip text="Books that have finished but haven't been judged onto a placeable tier yet -- Holding is uncapped, so this is purely a to-judge queue, not a verdict." />
          </div>
          <p className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>{data.holdingCount}</p>
          <p className="text-xs text-ink-warm-faint">not yet judged</p>
        </div>
        <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Placed</p>
            <InfoTooltip text="Every book with a row on the tier board -- S through F plus Holding, all counted together." />
          </div>
          <p className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>{data.totalPlaced}</p>
          <p className="text-xs text-ink-warm-faint">on the board</p>
        </div>
        <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Finished</p>
            <InfoTooltip text="Every book marked finished, whether or not it's made it onto the tier board yet. Compared against Placed as a sanity check -- normally the two match, since a fresh finish is auto-dropped into Holding." />
          </div>
          <p className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>{data.totalFinished}</p>
          <p className="text-xs text-ink-warm-faint">
            {data.totalFinished > data.totalPlaced ? `${data.totalFinished - data.totalPlaced} awaiting placement` : "all placed"}
          </p>
        </div>
      </div>
    </div>
  );
}
