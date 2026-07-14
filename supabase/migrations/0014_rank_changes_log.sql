-- Recovered/rewritten: this file previously contained a stray pasted image
-- URL instead of SQL (a copy-paste accident), leaving the migration history
-- out of sync with the live database. This is the real DDL, read directly
-- from the live table, so the history is accurate again -- `if not exists`
-- makes it safe to run against a database where the table already exists.
create table if not exists rank_changes (
  id bigint generated always as identity primary key,
  book_id integer not null references books (book_id) on delete cascade,
  year integer not null,
  old_rank integer,
  new_rank integer not null,
  changed_at timestamptz not null default now()
);
