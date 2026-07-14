import Link from "next/link";
import { fraunces } from "../shared/fonts";

export function WeeselYearCard({
  year,
  sealed,
  winnerCount,
}: {
  year: number;
  sealed: boolean;
  winnerCount: number;
}) {
  return (
    <Link
      href={sealed ? `/weesels/${year}` : `/weesels/ceremony/${year}`}
      className="flex flex-col items-center gap-1 rounded-xl border border-hairline bg-card/40 px-6 py-5 text-center transition hover:-translate-y-0.5 hover:bg-hover"
    >
      <p className={`${fraunces.className} text-2xl font-semibold text-ink`}>{year}</p>
      <p className="text-xs text-ink-faint">
        {sealed ? `Sealed · ${winnerCount} crown${winnerCount === 1 ? "" : "s"}` : "In season · run the ceremony"}
      </p>
    </Link>
  );
}
