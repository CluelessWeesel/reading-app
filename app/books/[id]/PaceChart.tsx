import type { PaceMetric } from "./derivedStats";

export function PaceChart({ metrics }: { metrics: PaceMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className="space-y-4">
      {metrics.map((m) => {
        const scale = Math.max(m.mine, m.avg, 1);
        return (
          <div key={m.label}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">{m.label}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs text-ink-warm-faint">You</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(m.mine / scale) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-warm">
                  {m.mine.toFixed(m.digits)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs text-ink-warm-faint">Usual</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-ink-faint/50"
                    style={{ width: `${(m.avg / scale) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-warm-faint">
                  {m.avg.toFixed(m.digits)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
