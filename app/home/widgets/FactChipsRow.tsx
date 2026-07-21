import Link from "next/link";
import type { ReactNode } from "react";
import type { FactChip, AuthorDrought } from "../factChipsMath";
import type { WidgetAccent } from "./WidgetCard";

function ChipShell({ emoji, accent, children }: { emoji: string; accent: WidgetAccent; children: ReactNode }) {
  return (
    <div className="surface-card flex h-full flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-center">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ background: `var(--accent-${accent}-chip)` }}
        aria-hidden
      >
        {emoji}
      </span>
      {children}
    </div>
  );
}

function Chip({ chip, accent }: { chip: FactChip; accent: WidgetAccent }) {
  return (
    <ChipShell emoji={chip.emoji} accent={accent}>
      <p className="text-[10px] uppercase tracking-wide text-ink-warm-faint">{chip.label}</p>
      <p className="text-xs font-semibold text-ink-warm">{chip.value}</p>
    </ChipShell>
  );
}

function DroughtsChip({ droughts }: { droughts: AuthorDrought[] }) {
  return (
    <ChipShell emoji="🏜️" accent="coral">
      <p className="text-[10px] uppercase tracking-wide text-ink-warm-faint">Droughts</p>
      <div className="space-y-0.5">
        {droughts.map((d) => (
          <p key={d.author} className="text-xs text-ink-warm">
            {d.authorId != null ? (
              <Link href={`/authors/${d.authorId}`} className="font-semibold hover:underline">
                {d.author}
              </Link>
            ) : (
              <span className="font-semibold">{d.author}</span>
            )}{" "}
            <span className="text-ink-warm-faint">{d.days}d</span>
          </p>
        ))}
      </div>
    </ChipShell>
  );
}

const ACCENTS: Record<string, WidgetAccent> = {
  milestone: "amber",
  ghost: "violet",
  dust: "teal",
  "longest-book": "pink",
  "avg-length": "pink",
  "genre-spread": "pink",
  "audio-share": "pink",
  fastest: "pink",
};

export function FactChipsRow({
  chips,
  droughts,
}: {
  chips: (FactChip | null)[];
  droughts: AuthorDrought[] | null;
}) {
  const shown = chips.filter((c): c is FactChip => c != null);
  if (shown.length === 0 && !droughts) return null;

  return (
    <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {shown.map((chip) => (
        <Chip key={chip.key} chip={chip} accent={ACCENTS[chip.key] ?? "blue"} />
      ))}
      {droughts && droughts.length > 0 && <DroughtsChip droughts={droughts} />}
    </div>
  );
}
