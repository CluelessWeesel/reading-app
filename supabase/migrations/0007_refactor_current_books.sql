-- Old current_books stored free-text titles with no real link to the books
-- table -- one of its 2 rows ("Thief of Clay") doesn't match any existing
-- book_id at all, and the other ("The Book Thief") matches a book that was
-- already fully read years ago (treating that as "resume" vs "a new reread"
-- is a real decision, not something to silently guess at).
--
-- NOTE: this drops both existing current_books rows. Re-add them via the
-- new "Start a book" flow after this runs -- takes seconds each.
drop table if exists current_books;

create table current_books (
  id bigint generated always as identity primary key,
  book_id integer not null unique references books (book_id) on delete cascade,
  position numeric not null default 0 check (position >= 0)
);
