-- owned: null = unsorted/unknown (existing rows with no Goodreads match stay
-- here), true = you already have a copy, false = still need to buy it.
alter table tbr add column if not exists owned boolean;

-- The Goodreads export only has page counts, not word counts, and tbr
-- previously only had word_count (mirroring books, which has both).
alter table tbr add column if not exists page_count integer;
alter table tbr add constraint tbr_page_count_nonnegative check (page_count is null or page_count >= 0);
