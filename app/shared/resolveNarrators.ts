import type { Pool, PoolClient } from "pg";

const SKIP_NAMES = new Set(["full cast"]);

function normalizeNameKey(n: string): string {
  return n.trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
}

function splitNarrators(raw: string): string[] {
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && !SKIP_NAMES.has(normalizeNameKey(n)));
}

// The single place book_narrators gets kept in sync with books.narrator on
// a live write path (book edit) -- same split/skip rules as
// scripts/backfill-narrators.ts applies in bulk. Without this, book_narrators
// only ever got populated by manually re-running that script, so every book
// finished since the last run sat unlinked -- invisible on /narrators and on
// its narrator's own page -- until someone noticed and re-ran it. Re-derives
// the full link set from the current text every save, so a narrator typo
// fix or an edit from one narrator to another self-heals instead of leaving
// a stale link behind.
export async function resolveNarrators(client: Pool | PoolClient, bookId: number, narratorText: string | null): Promise<void> {
  const names = narratorText ? splitNarrators(narratorText) : [];

  await client.query(`delete from book_narrators where book_id = $1`, [bookId]);
  if (names.length === 0) return;

  for (const name of names) {
    const { rows } = await client.query<{ id: number }>(
      `insert into narrators (name) values ($1)
       on conflict (name) do update set name = excluded.name
       returning id`,
      [name]
    );
    const narratorId = rows[0]?.id;
    if (narratorId == null) continue;
    await client.query(
      `insert into book_narrators (book_id, narrator_id) values ($1, $2) on conflict do nothing`,
      [bookId, narratorId]
    );
  }
}
