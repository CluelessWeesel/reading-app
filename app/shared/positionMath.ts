// Pure functions, no React/browser dependencies -- shared between the
// client-side live-preview UI and the server-side API routes that do the
// authoritative calculation, so the math can't drift between the two.

// Converts a change in position into pages read. Physical/ebook track page
// number directly, so the delta *is* pages. Audio tracks percent, so it
// needs the book's page_count to convert a percent delta into pages; if
// that's missing, there's nothing sensible to compute (returns null rather
// than guessing).
export function computePagesDelta(
  newPosition: number,
  basePosition: number,
  formatType: string | null,
  pageCount: number | null
): number | null {
  if (formatType === "audio") {
    if (pageCount == null) return null;
    return Math.round(((newPosition - basePosition) / 100) * pageCount);
  }
  return Math.round(newPosition - basePosition);
}

// The furthest a position can legitimately go: 100 (percent) for audio,
// or the book's own page_count for physical/ebook. Null means there's
// nothing to enforce -- a physical/ebook book with no page_count set
// (schema allows it, even though the UI discourages it).
export function maxPosition(formatType: string | null, pageCount: number | null): number | null {
  if (formatType === "audio") return 100;
  return pageCount;
}

export function formatPositionLabel(
  position: number,
  formatType: string | null,
  pageCount: number | null
): string {
  if (formatType === "audio") return `${position}%`;
  if (pageCount != null) return `page ${position} of ${pageCount}`;
  return `page ${position}`;
}

export function positionQuestionLabel(formatType: string | null): string {
  return formatType === "audio" ? "What percent?" : "What page are you on?";
}

export function positionInputMode(formatType: string | null): "numeric" | "decimal" {
  return formatType === "audio" ? "decimal" : "numeric";
}
