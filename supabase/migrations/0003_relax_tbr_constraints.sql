-- The original tbr import required word_count, subgenre, and genre on every
-- row (matched the source spreadsheet, which happened to have them all
-- filled in). The new "add a TBR entry" form only requires a title, so
-- these three become optional; existing rows are unaffected since none of
-- them were ever NULL.
alter table tbr alter column word_count drop not null;
alter table tbr alter column subgenre drop not null;
alter table tbr alter column genre drop not null;
