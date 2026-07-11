// Normalizes a title for matching: trims, lowercases, drops a trailing
// period, collapses whitespace, and treats a leading "the " as optional.
// Shared by every script that matches titles against the books table, so
// they can't silently drift apart.
export function normalizeTitle(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}
