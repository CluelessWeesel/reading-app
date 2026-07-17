-- tbr.created_at is one shared timestamp regardless of shelf, but "date
-- added" now needs to mean two different things depending on whether a book
-- is owned or not owned: when it was added to the *purchased* pile vs. when
-- it was added to the *want-to-buy* pile. These are independent going
-- forward -- a book can move between shelves and each move stamps its own
-- shelf's date, without touching the other. created_at itself is untouched
-- (still whatever it already means for a row that's never been sorted onto
-- either shelf).
alter table tbr add column if not exists owned_added_at timestamptz;
alter table tbr add column if not exists unowned_added_at timestamptz;
