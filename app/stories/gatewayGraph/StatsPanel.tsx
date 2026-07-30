import { fraunces } from "../../shared/fonts";
import { formatCompactNumber } from "../../shared/formatCompactNumber";
import type { GatewayGraphSummary, LeaderboardEntry } from "./math";

function Leaderboard({ title, entries, format }: { title: string; entries: LeaderboardEntry[]; format?: (v: number) => string }) {
  if (entries.length === 0) return null;
  const max = entries[0].value || 1;
  return (
    <div className="mt-3 first:mt-0">
      {title && <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-warm-faint">{title}</h3>}
      {entries.map((e, i) => (
        <div key={e.key} className="mb-1.5 flex items-center gap-2 text-sm">
          <span className="w-3.5 shrink-0 text-xs text-ink-warm-faint">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-ink-warm">{e.label}</span>
          <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-gold-ink" style={{ width: `${(e.value / max) * 100}%` }} />
          </span>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-warm-faint">
            {format ? format(e.value) : e.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StatsPanel({ summary }: { summary: GatewayGraphSummary }) {
  const isSparse = summary.bloodlines.length === 0 && summary.orphans.length === 0;

  return (
    <div className="rounded-2xl border border-gold bg-surface-1 p-5 shadow-sm">
      <h2 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Stats</h2>
      <p className="mb-3 mt-1 text-xs text-ink-warm-faint">
        {isSparse ? "Every widget here degrades the same way -- quiet, not broken." : "All computed from gateway fields."}
      </p>

      {isSparse ? (
        <>
          <StatBlock title="Most influential">
            <p className="text-sm text-ink-warm-faint">Not enough traced yet to rank anything.</p>
          </StatBlock>
          <StatBlock title="Orphans">
            <StatRow label="Untraced" value={`${summary.untracedCount} of ${summary.totalBooks}`} />
          </StatBlock>
        </>
      ) : (
        <>
          <StatBlock title="Most influential -- by count">
            {summary.influentialByCount.length > 0 ? (
              <Leaderboard title="" entries={summary.influentialByCount} />
            ) : (
              <p className="text-sm text-ink-warm-faint">Not enough traced yet to rank anything.</p>
            )}
            <Leaderboard title="by pages" entries={summary.influentialByPages} format={formatCompactNumber} />
            <Leaderboard title="by downstream score" entries={summary.influentialByScore} format={(v) => v.toFixed(1)} />
          </StatBlock>

          {summary.genreShares.length > 0 && (
            <StatBlock title="Reading bloodlines">
              <div className="flex flex-col gap-2.5">
                {summary.genreShares.map((s) => (
                  <div key={s.genre}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-ink-warm">
                        {s.genre} traces to <b>{s.rootLabel}</b>
                      </span>
                      <span className="font-bold tabular-nums text-gold-ink">{Math.round(s.pct * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gold-ink" style={{ width: `${s.pct * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </StatBlock>
          )}

          {summary.deepestChain && (
            <StatBlock title="Deepest chain">
              <div className="py-1 text-center">
                <div className={`${fraunces.className} text-3xl font-semibold text-gold-ink`}>{summary.deepestChain.size}</div>
                <div className="mt-1 text-xs text-ink-warm-faint">books, one unbroken line</div>
              </div>
              <p className="mt-2 text-center text-sm italic leading-relaxed text-ink-warm-muted" style={{ fontFamily: "Georgia, serif" }}>
                {summary.deepestChain.steps.map((s) => s.label).join(" ← ")}
              </p>
            </StatBlock>
          )}

          {summary.gatewayEffect && summary.gatewayEffect.driven != null && summary.gatewayEffect.selfFound != null && (
            <StatBlock title="Gateway effect">
              <div className="flex gap-2.5">
                <div className="flex-1 rounded-xl bg-surface-2 py-2.5 text-center">
                  <div className={`${fraunces.className} text-2xl font-semibold text-gold-ink`}>
                    {summary.gatewayEffect.driven.toFixed(1)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-warm-faint">gateway-driven</div>
                </div>
                <div className="flex-1 rounded-xl bg-surface-2 py-2.5 text-center">
                  <div className={`${fraunces.className} text-2xl font-semibold text-ink-warm`}>
                    {summary.gatewayEffect.selfFound.toFixed(1)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-warm-faint">self-found</div>
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-ink-warm-muted">
                {(() => {
                  const delta = summary.gatewayEffect.driven - summary.gatewayEffect.selfFound;
                  const sign = delta >= 0 ? "+" : "";
                  return `${sign}${delta.toFixed(1)} avg score when a book has a traced gateway`;
                })()}
              </p>
            </StatBlock>
          )}

          {summary.personLeaderboard.length > 0 && (
            <StatBlock title="Person leaderboard">
              <Leaderboard title="" entries={summary.personLeaderboard} />
            </StatBlock>
          )}

          <StatBlock title="Orphans">
            <StatRow label="Count" value={String(summary.orphanStats.count)} />
            {summary.orphanStats.longestStandingLabel && (
              <StatRow label="Longest-standing" value={summary.orphanStats.longestStandingLabel} />
            )}
          </StatBlock>
        </>
      )}
    </div>
  );
}

function StatBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-gold pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-warm-faint">{title}</h3>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between text-sm">
      <span className="text-ink-warm">{label}</span>
      <span className="tabular-nums text-ink-warm-faint">{value}</span>
    </div>
  );
}
