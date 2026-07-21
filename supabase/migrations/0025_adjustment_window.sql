-- End-of-year adjustment window: up to 5 books' score and/or rank may be
-- touched for the just-ended year during its Dec25-Jan31 window, each
-- change logged with a one-line reason. `reason` is nullable and only ever
-- set for these adjustment-window events -- a plain reorder or score edit
-- made outside the window (current-year reading, or an unusual historical
-- edit) logs with reason = null exactly as before, so `reason is not null`
-- reliably marks "this was a sanctioned adjustment" on both tables.
alter table rank_changes add column if not exists reason text;

-- Mirrors rank_changes, but for books.score. Unlike rank_changes (which
-- only ever gets a row when the rank actually changes), this logs every
-- score edit generally, not just adjustment-window ones -- reason is what
-- distinguishes the two, same as rank_changes.
create table if not exists score_changes (
  id bigint generated always as identity primary key,
  book_id integer not null references books (book_id) on delete cascade,
  year integer not null,
  old_score numeric(3, 1),
  new_score numeric(3, 1),
  reason text,
  changed_at timestamptz not null default now()
);
create index if not exists score_changes_book_id_idx on score_changes (book_id);

alter table score_changes enable row level security;
