// Extracts a simple surname for alphabetizing authors by last name -- takes
// the final whitespace-separated token. Imperfect for multi-word surnames
// (e.g. "Le Guin", "van Gogh") but matches this app's existing simple-heuristic
// precedent for title sorting (see titleSortKey) rather than pulling in a
// full name-parsing library for a personal library sort.
export function authorSortKey(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}
