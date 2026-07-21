-- D turned out to have far more variance than S/A/B/C -- splitting it into
-- D/E/F gives that stretch of the library the same resolving power the
-- higher tiers already have. Existing D placements are left exactly where
-- they are (nothing is reassigned) -- the split only widens what D can
-- next be moved into.
alter table book_tiers drop constraint if exists book_tiers_tier_check;
alter table book_tiers add constraint book_tiers_tier_check
  check (tier in ('S', 'A', 'B', 'C', 'D', 'E', 'F', 'holding'));

alter table tier_moves drop constraint if exists tier_moves_from_tier_check;
alter table tier_moves add constraint tier_moves_from_tier_check
  check (from_tier in ('S', 'A', 'B', 'C', 'D', 'E', 'F', 'holding'));

alter table tier_moves drop constraint if exists tier_moves_to_tier_check;
alter table tier_moves add constraint tier_moves_to_tier_check
  check (to_tier in ('S', 'A', 'B', 'C', 'D', 'E', 'F', 'holding'));

-- D's old 30% three-way split evenly; S/A/B/C are untouched.
update app_settings set value = '10' where key = 'tier_capacity_d';
insert into app_settings (key, value) values
  ('tier_capacity_e', '10'),
  ('tier_capacity_f', '10')
on conflict (key) do nothing;
