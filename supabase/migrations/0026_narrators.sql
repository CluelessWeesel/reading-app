-- One row per distinct narrator name split off books.narrator (comma-
-- separated, confirmed the only separator actually in use). Many-to-many
-- via book_narrators -- a handful of audiobooks are full-cast duets/casts,
-- so a single narrator_id FK on books wouldn't hold. books.narrator (free
-- text) is untouched -- everything that already reads it keeps working;
-- the join table is additive, for /narrators pages and linkification.
create table if not exists narrators (
  id bigint generated always as identity primary key,
  name text not null unique,
  photo_url text
);

create table if not exists book_narrators (
  book_id integer not null references books (book_id) on delete cascade,
  narrator_id bigint not null references narrators (id) on delete cascade,
  primary key (book_id, narrator_id)
);
create index if not exists book_narrators_narrator_id_idx on book_narrators (narrator_id);

alter table narrators enable row level security;
alter table book_narrators enable row level security;
