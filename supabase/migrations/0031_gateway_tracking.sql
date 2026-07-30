-- Gateway tracking: "I read this because of ___" -- at most one of a book
-- (gateway_book_id), a person (gateway_person), or a source (gateway_source)
-- per row, on both books and tbr, forming the single structural edge the
-- inspiration tree is built from. gateway_note is a separate, unconstrained
-- free-text field for a secondary "also inspired by" influence -- purely
-- descriptive, not a graph edge, so it never participates in the tree or
-- the cycle check below. gateway_book_id forms a DAG over books; a trigger
-- below rejects self-reference and any deeper cycle with a friendly
-- message rather than a raw constraint violation.

alter table books
  add column gateway_book_id integer references books (book_id) on delete set null,
  add column gateway_person text,
  add column gateway_source text,
  add column gateway_note text;

alter table tbr
  add column gateway_book_id integer references books (book_id) on delete set null,
  add column gateway_person text,
  add column gateway_source text,
  add column gateway_note text;

alter table books add constraint books_gateway_single_source check (
  (case when gateway_book_id is not null then 1 else 0 end +
   case when gateway_person is not null then 1 else 0 end +
   case when gateway_source is not null then 1 else 0 end) <= 1
);
alter table books add constraint books_gateway_person_not_blank
  check (gateway_person is null or length(trim(gateway_person)) > 0);
alter table books add constraint books_gateway_source_not_blank
  check (gateway_source is null or length(trim(gateway_source)) > 0);
alter table books add constraint books_gateway_note_not_blank
  check (gateway_note is null or length(trim(gateway_note)) > 0);

alter table tbr add constraint tbr_gateway_single_source check (
  (case when gateway_book_id is not null then 1 else 0 end +
   case when gateway_person is not null then 1 else 0 end +
   case when gateway_source is not null then 1 else 0 end) <= 1
);
alter table tbr add constraint tbr_gateway_person_not_blank
  check (gateway_person is null or length(trim(gateway_person)) > 0);
alter table tbr add constraint tbr_gateway_source_not_blank
  check (gateway_source is null or length(trim(gateway_source)) > 0);
alter table tbr add constraint tbr_gateway_note_not_blank
  check (gateway_note is null or length(trim(gateway_note)) > 0);

-- Only books.gateway_book_id can ever form a cycle -- tbr rows aren't
-- referenceable as a gateway target (gateway_book_id points at books, and a
-- tbr row has no book_id of its own yet), so tbr needs no trigger.
create or replace function check_gateway_book_acyclic() returns trigger as $$
declare
  current_id integer := new.gateway_book_id;
  gateway_title text;
  hops integer := 0;
begin
  if current_id is null then
    return new;
  end if;

  select title into gateway_title from books where book_id = new.gateway_book_id;

  while current_id is not null loop
    if current_id = new.book_id then
      raise exception 'That would create a gateway cycle: tracing back through %''s gateway chain leads right back to this book.', gateway_title
        using errcode = 'P0001';
    end if;
    hops := hops + 1;
    if hops > 10000 then
      raise exception 'Gateway chain unexpectedly long -- refusing to keep following it.' using errcode = 'P0001';
    end if;
    select gateway_book_id into current_id from books where book_id = current_id;
  end loop;

  return new;
end;
$$ language plpgsql;

create trigger books_gateway_acyclic
  before insert or update of gateway_book_id on books
  for each row execute function check_gateway_book_acyclic();
