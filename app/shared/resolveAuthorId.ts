import type { Pool, PoolClient } from "pg";

// The single place books.author_id gets set on a live write path (start-
// book, book edit) -- looks up an exact match in authors, creating a new
// row if this is a name never seen before, same "one row per distinct
// author string" rule scripts/backfill-authors.ts enforces in bulk. Without
// this, author_id only ever got set by manually re-running that script, so
// every book finished since the last run sat unlinked -- invisible on its
// author's page and absent from author-scoped leaderboards -- until
// someone noticed and re-ran it.
export async function resolveAuthorId(client: Pool | PoolClient, authorName: string | null): Promise<number | null> {
  const name = authorName?.trim();
  if (!name) return null;
  const { rows } = await client.query<{ id: number }>(
    `insert into authors (name) values ($1)
     on conflict (name) do update set name = excluded.name
     returning id`,
    [name]
  );
  return rows[0]?.id ?? null;
}
