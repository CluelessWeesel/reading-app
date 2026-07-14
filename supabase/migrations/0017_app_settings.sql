-- Small generic key/value settings table -- first use is the user's
-- birthday (stored as "MM-DD", no year needed) for the "Birthday Read"
-- record on /stats. Editable inline from that card, no separate admin UI.
create table if not exists app_settings (
  key text primary key,
  value text not null
);
