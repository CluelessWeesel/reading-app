export type BookForecast = { bookId: number; title: string; estFinish: string | null };

// "When will I finish my current books" -- reuses exactly the same
// estimateFinishDate figure already computed for the Twin Altars hero (see
// getRightNowBooks in page.tsx), just surfaced again here as its own
// standing forecast rather than recomputed differently.
export function computeForecast(
  currentBooks: { book_id: number; title: string; estFinish: string | null }[]
): BookForecast[] | null {
  const withEstimate = currentBooks.filter((b) => b.estFinish != null);
  return withEstimate.length > 0
    ? withEstimate.map((b) => ({ bookId: b.book_id, title: b.title, estFinish: b.estFinish }))
    : null;
}
