// App-side twin of scripts/lib/normalizeTitle.ts (kept separate rather than
// imported across the script/app boundary, same way resolveAuthorId.ts is
// the app's own canonical author-matching logic distinct from
// backfill-authors.ts's). Normalizes a title for matching: trims,
// lowercases, drops a trailing period, collapses whitespace, and treats a
// leading "the " as optional.
export function normalizeTitle(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}
