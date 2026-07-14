export function StarRating({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-ink-faint">Unrated</span>;
  }

  const clamped = Math.max(0, Math.min(5, score));

  return (
    <div
      className="inline-flex gap-0.5 leading-none tracking-tight"
      aria-label={`${score} out of 5 stars`}
      title={`${score} / 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        // Each star's own fill fraction, computed independently -- avoids
        // clipping a single continuous-percentage overlay across a gapped
        // flex row, where flex-shrink can distort exactly where the cut
        // falls instead of landing cleanly on one star's boundary.
        const fill = Math.max(0, Math.min(1, clamped - i));
        return (
          <span key={i} className="relative inline-block text-star-empty">
            ★
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden text-accent"
                style={{ width: `${fill * 100}%` }}
              >
                ★
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
