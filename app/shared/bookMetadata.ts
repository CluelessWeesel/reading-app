export type BookMetadata = { genres: string[]; series: string[] };

async function attempt(): Promise<BookMetadata> {
  const res = await fetch("/api/book-metadata");
  if (!res.ok) throw new Error(`book-metadata request failed (${res.status})`);
  const data = await res.json();
  return {
    genres: Array.isArray(data.genres) ? data.genres : [],
    series: Array.isArray(data.series) ? data.series : [],
  };
}

// One retry after a short backoff covers transient blips (a dev-server
// reload, a brief DB pooler hiccup) without hammering the endpoint --
// callers still need to handle a second failure, since genre/series
// options silently staying empty reads as "there are no genres."
export async function fetchBookMetadata(): Promise<BookMetadata> {
  try {
    return await attempt();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await attempt();
  }
}
