export function RatingBars({ ratings }: { ratings: { category: string; score: number }[] }) {
  if (ratings.length === 0) {
    return <p className="text-sm text-ink-warm-faint">No ratings recorded.</p>;
  }

  return (
    <div className="space-y-3">
      {ratings.map((r) => (
        <div key={r.category}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-ink-warm-muted">{r.category}</span>
            <span className="tabular-nums text-ink-warm-faint">{r.score.toFixed(1)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(r.score / 5) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
