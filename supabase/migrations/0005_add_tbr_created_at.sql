-- Tracks when each TBR entry was added. Only ever set on insert (never
-- touched by an edit), so MAX(created_at) across all entries is exactly
-- "when did I last add a new book" -- not "when did I last edit one".
alter table tbr add column if not exists created_at timestamptz not null default now();
