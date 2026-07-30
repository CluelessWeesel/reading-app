-- Whether a TBR entry can be borrowed from a library -- two flags, not a
-- library-name text field: "uni library" specifically, and "any other
-- library" as one grouped bucket (the point is browsing "can I just borrow
-- this", not tracking which specific public library branch has it).
alter table tbr
  add column library_uni boolean not null default false,
  add column library_other boolean not null default false;
