-- Mid-season "Weesels watch?" flags from the finish ceremony -- a shortlist,
-- not a commitment. A book can be flagged toward multiple categories; these
-- surface as pre-starred candidates (and add-suggestions for anything the
-- eligibility engine wouldn't have auto-included) once that year's ceremony
-- pre-flight runs.
create table if not exists weesel_watchlist (
  id bigint generated always as identity primary key,
  book_id integer not null references books(book_id) on delete cascade,
  category_id bigint not null references weesel_categories(id),
  created_at timestamptz not null default now(),
  unique (book_id, category_id)
);
