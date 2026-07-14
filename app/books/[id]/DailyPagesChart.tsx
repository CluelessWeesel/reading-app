// Real day-by-day pages read, from daily_reading -- only exists for books
// tracked through the app's own /log flow, so this only ever renders for
// those; older bulk-imported books have no per-day granularity to show.
export function DailyPagesChart({ days }: { days: { date: string; pages: number }[] }) {
  if (days.length === 0) return null;

  const max = Math.max(...days.map((d) => d.pages), 1);

  return (
    <div>
      <div className="flex h-32 items-end gap-1 overflow-x-auto">
        {days.map((d) => (
          <div key={d.date} className="flex h-full min-w-[10px] flex-1 flex-col justify-end" title={`${d.date}: ${d.pages} pages`}>
            <div
              className="w-full rounded-t bg-accent"
              style={{ height: `${Math.max((d.pages / max) * 100, d.pages > 0 ? 4 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{days[0].date}</span>
        {days.length > 1 && <span>{days[days.length - 1].date}</span>}
      </div>
    </div>
  );
}
