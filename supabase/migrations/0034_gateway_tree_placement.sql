-- Manual placement for the drag-to-arrange gateway-tree view. Y is never
-- stored -- always computed fresh from date_finished (see arrangeMath.ts's
-- dateToY) -- only X is user-chosen. Presence of a row IS the "placed" flag
-- (same convention as book_tiers, 0028_tier_board.sql): a traced book with
-- no row here shows in the "to place" tray instead of on the canvas.
--
-- Edge style lives on the same row as the CHILD book's placement, since
-- every book has at most one outgoing edge (to its one gateway, enforced by
-- books_gateway_single_source) -- a person/source node can never itself
-- have an outgoing edge, so it structurally never needs these columns.
-- edge_control_dx/dy are a 2D offset from the edge's current midpoint
-- (recomputed live from both endpoints' current positions at render time,
-- not stored), in base/zoom=1 pixels.
create table if not exists book_graph_placement (
  book_id integer primary key references books (book_id) on delete cascade,
  x real not null,
  edge_curved boolean not null default false,
  edge_control_dx real,
  edge_control_dy real,
  placed_at timestamptz not null default now(),
  constraint book_graph_placement_control_point_only_when_curved check (
    edge_curved or (edge_control_dx is null and edge_control_dy is null)
  )
);
alter table book_graph_placement enable row level security;

-- Person/source bloodline roots have no date of their own, so (unlike
-- books) they need a fully free-drag x AND y position.
create table if not exists gateway_node_placement (
  node_key text primary key,
  x real not null,
  y real not null,
  placed_at timestamptz not null default now(),
  constraint gateway_node_placement_key_kind check (node_key like 'person:%' or node_key like 'source:%')
);
alter table gateway_node_placement enable row level security;
