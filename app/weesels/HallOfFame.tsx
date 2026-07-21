import Link from "next/link";
import { fraunces } from "../shared/fonts";
import type { CrownEntry, CrownsPerYear, DynastyEntry } from "./types";

function EntityLabel({ entry, kind }: { entry: CrownEntry; kind: "book" | "author" }) {
  if (kind === "book" && entry.bookId != null) {
    return (
      <Link href={`/books/${entry.bookId}`} className="truncate hover:underline">
        {entry.label}
      </Link>
    );
  }
  // Best Narration entries carry a narratorId instead of an authorId --
  // checked first so a narrator's crowns link to their own page rather than
  // staying unlinked (see weeselMath.ts's creditedNarratorId).
  if (kind === "author" && entry.narratorId != null) {
    return (
      <Link href={`/narrators/${entry.narratorId}`} className="truncate hover:underline">
        {entry.label}
      </Link>
    );
  }
  if (kind === "author" && entry.authorId != null) {
    return (
      <Link href={`/authors/${entry.authorId}`} className="truncate hover:underline">
        {entry.label}
      </Link>
    );
  }
  return <span className="truncate">{entry.label}</span>;
}

function EntryList({
  entries,
  kind,
  suffix,
  emptyMessage = "None yet.",
}: {
  entries: CrownEntry[];
  kind: "book" | "author";
  suffix: (n: number) => string;
  emptyMessage?: string;
}) {
  if (entries.length === 0) return <p className="text-xs text-ink-warm-faint">{emptyMessage}</p>;
  return (
    <ul className="space-y-1">
      {entries.map((e) => (
        <li key={e.label} className="flex items-center justify-between gap-2 text-sm text-ink-warm">
          <EntityLabel entry={e} kind={kind} />
          <span className="shrink-0 text-xs text-ink-warm-faint">{suffix(e.count)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HallOfFame({
  bookCrowns,
  authorCrowns,
  mostNominatedBooks,
  mostNominatedAuthors,
  dynasties,
  crownsPerYear,
}: {
  bookCrowns: CrownEntry[];
  authorCrowns: CrownEntry[];
  mostNominatedBooks: CrownEntry[];
  mostNominatedAuthors: CrownEntry[];
  dynasties: DynastyEntry[];
  crownsPerYear: CrownsPerYear[];
}) {
  return (
    <section className="mt-10">
      <h2 className={`${fraunces.className} mb-4 text-xl font-semibold text-ink-warm`}>Hall of Fame</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gold bg-surface-1 p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-warm">Most crowned books</h3>
          <EntryList entries={bookCrowns.slice(0, 8)} kind="book" suffix={(n) => `${n} crown${n === 1 ? "" : "s"}`} />
        </div>

        <div className="rounded-xl border border-gold bg-surface-1 p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-warm">Most crowned authors</h3>
          <EntryList
            entries={authorCrowns.slice(0, 8)}
            kind="author"
            suffix={(n) => `${n} crown${n === 1 ? "" : "s"}`}
          />
        </div>

        <div className="rounded-xl border border-gold bg-surface-1 p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-warm">Nominated most, won least</h3>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Books</p>
          <EntryList
            entries={mostNominatedBooks.slice(0, 5)}
            kind="book"
            suffix={(n) => `${n} nom${n === 1 ? "" : "s"}`}
          />
          <p className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Authors</p>
          <EntryList
            entries={mostNominatedAuthors.slice(0, 5)}
            kind="author"
            suffix={(n) => `${n} nom${n === 1 ? "" : "s"}`}
          />
        </div>

        <div className="rounded-xl border border-gold bg-surface-1 p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-warm">Crowns per year</h3>
          <ul className="space-y-1">
            {crownsPerYear.map((c) => (
              <li key={c.year} className="flex items-center justify-between text-sm">
                <span className="text-ink-warm">{c.year}</span>
                <span className="text-xs text-ink-warm-faint">
                  {c.count} crown{c.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gold bg-surface-1 p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink-warm">Category dynasties</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {dynasties.map((d) => (
            <div key={d.category}>
              <p className="mb-1 text-xs font-medium text-ink-warm-faint">{d.category}</p>
              <ul className="space-y-0.5">
                {d.winners.map((w) => (
                  <li key={w.year} className="flex items-center gap-2 text-sm">
                    <span className="w-10 shrink-0 text-xs text-ink-warm-faint">{w.year}</span>
                    {w.bookId != null ? (
                      <Link href={`/books/${w.bookId}`} className="truncate text-ink-warm hover:underline">
                        {w.label}
                      </Link>
                    ) : w.narratorId != null ? (
                      <Link href={`/narrators/${w.narratorId}`} className="truncate text-ink-warm hover:underline">
                        {w.label}
                      </Link>
                    ) : w.authorId != null ? (
                      <Link href={`/authors/${w.authorId}`} className="truncate text-ink-warm hover:underline">
                        {w.label}
                      </Link>
                    ) : (
                      <span className="truncate text-ink-warm">{w.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
