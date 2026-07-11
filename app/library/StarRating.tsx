export function StarRating({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-ink-faint">Unrated</span>;
  }

  const pct = Math.max(0, Math.min(100, (score / 5) * 100));

  return (
    <div
      className="relative inline-flex leading-none tracking-tight"
      aria-label={`${score} out of 5 stars`}
      title={`${score} / 5`}
    >
      <div className="flex gap-0.5 text-star-empty">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>★</span>
        ))}
      </div>
      <div
        className="absolute inset-0 flex gap-0.5 overflow-hidden text-accent"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>★</span>
        ))}
      </div>
    </div>
  );
}
