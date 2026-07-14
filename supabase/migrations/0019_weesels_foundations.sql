-- Weesels foundations: a canonical category list, links from the existing
-- free-text weesels rows to books, and a sealed-years marker for the
-- /weesels Archive and /rankings podium/honours features.

create table if not exists weesel_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  prestige_order integer not null unique,
  rereads_eligible boolean not null default false,
  min_candidates integer not null default 3,
  active boolean not null default true
);

insert into weesel_categories (name, prestige_order, rereads_eligible) values
  ('Author of the Year', 1, false),
  ('Novel of the Year', 2, false),
  ('Non-Fiction of the Year', 3, false),
  ('Best New Author', 4, false),
  ('Best Indie', 5, false),
  ('Most Thought-Provoking', 6, true),
  ('Best Series', 7, false),
  ('Best Reread', 8, true),
  ('Best to Recommend', 9, true),
  ('Most Anticipated Author', 10, false),
  ('Best Narration', 11, true)
on conflict (name) do nothing;

-- Nullable and only ever backfilled to true (see scripts/backfill-weesels.ts)
-- -- null means "unknown", not "not indie".
alter table books add column if not exists indie boolean;

alter table weesels add column if not exists category_id bigint references weesel_categories(id);
alter table weesels add column if not exists book_id bigint references books(book_id);
alter table weesels add column if not exists citation text;

-- A year's presence here means it's sealed; sealed_at records when. Absence
-- (e.g. the current year) means "in season".
create table if not exists weesel_years (
  year integer primary key,
  sealed_at timestamptz not null default now()
);
insert into weesel_years (year) values (2023), (2024), (2025) on conflict do nothing;
