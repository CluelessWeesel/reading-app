// Strips a leading "The"/"A"/"An" so alphabetical title sorts land under the
// actual first meaningful word (e.g. "The Hobbit" sorts under H, not T).
export function titleSortKey(title: string): string {
  return title.replace(/^(the|an?)\s+/i, "").trim();
}
