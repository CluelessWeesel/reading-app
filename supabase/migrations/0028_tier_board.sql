-- The Tier Board: a single all-time board ("what does this book mean to me
-- now?") completely separate from the yearly score-based rankings ("how
-- good was it?"). Every finished book eventually gets exactly one row here
-- -- 'holding' is a real tier value (an uncapped catch-all), not a null/
-- absent state, so "does this book have a tier row yet" cleanly means
-- "has it entered the board at all."
create table if not exists book_tiers (
  book_id integer primary key references books (book_id) on delete cascade,
  tier text not null check (tier in ('S', 'A', 'B', 'C', 'D', 'holding')),
  position integer not null,
  placed_at timestamptz not null default now()
);
create index if not exists book_tiers_tier_idx on book_tiers (tier, position);
alter table book_tiers enable row level security;

-- Every move after the opening fill (see app_settings.tier_fill_completed)
-- writes a row here -- from_tier is null only for a book's very first
-- entry onto the board (a fresh finish landing in Holding). note is
-- nullable and free-text, for a future "why did this move" annotation --
-- nothing currently requires it.
create table if not exists tier_moves (
  id bigint generated always as identity primary key,
  book_id integer not null references books (book_id) on delete cascade,
  from_tier text check (from_tier in ('S', 'A', 'B', 'C', 'D', 'holding')),
  to_tier text not null check (to_tier in ('S', 'A', 'B', 'C', 'D', 'holding')),
  moved_at timestamptz not null default now(),
  note text
);
create index if not exists tier_moves_book_id_idx on tier_moves (book_id);
create index if not exists tier_moves_moved_at_idx on tier_moves (moved_at);
alter table tier_moves enable row level security;

-- Capacities are a percentage of total placed books (every row in
-- book_tiers, Holding included), not a fixed count -- so the board scales
-- as the library grows. Editable like any other app_settings row (see
-- app/api/app-settings/route.ts); tier_fill_completed flips once the
-- opening one-by-one fill ceremony has placed every eligible book, after
-- which every move gets logged to tier_moves.
insert into app_settings (key, value) values
  ('tier_capacity_s', '5'),
  ('tier_capacity_a', '10'),
  ('tier_capacity_b', '20'),
  ('tier_capacity_c', '35'),
  ('tier_capacity_d', '30'),
  ('tier_fill_completed', 'false')
on conflict (key) do nothing;
