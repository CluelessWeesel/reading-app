import { fraunces } from "../shared/fonts";

export function HomeHeader({
  streak,
  verdict,
}: {
  streak: number | null;
  verdict: "on track" | "behind pace" | null;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>The Weeselry</h1>

      <div className="flex flex-wrap items-center gap-2">
        {streak != null && streak > 0 && (
          <span className="rounded-full border border-gold bg-surface-1 px-3 py-1 text-xs font-medium text-ink-warm-muted">
            {streak} day streak
          </span>
        )}
        {verdict && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              verdict === "on track" ? "bg-accent-green-chip text-accent-green" : "bg-accent-pink-chip text-accent-pink"
            }`}
          >
            {verdict === "on track" ? "Ahead of pace" : "Behind pace"}
          </span>
        )}
      </div>
    </header>
  );
}
