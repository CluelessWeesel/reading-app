-- Inserting a book at a chosen rank requires shifting every row below it
-- down by one, in a single multi-row UPDATE. Postgres checks a normal
-- unique constraint per-row as each row is updated, which would hit a
-- transient collision mid-shift (row becomes rank 6 while another row still
-- holds rank 6). Making the constraint deferred means it's only checked at
-- COMMIT, once the whole shift is consistent.
alter table book_rankings
  alter constraint book_rankings_list_id_rank_key deferrable initially deferred;

-- The ceremony's Score step is independently skippable, so a book can reach
-- ranking placement with no score yet.
alter table book_rankings alter column score drop not null;
