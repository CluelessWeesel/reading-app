-- Third edge style for the drag-to-arrange tree: a double (S-shaped) curve
-- with two draggable handles, alongside straight and single-curved.
--
-- A row is "double" exactly when edge_control2_dx/dy are present. For a
-- double curve, (edge_control_dx, edge_control_dy) and (edge_control2_dx,
-- edge_control2_dy) are the two ON-CURVE handle offsets from the straight
-- chord's 1/3 and 2/3 points (the cubic's control points are derived from
-- them at render time -- see ArrangeTree.tsx's cubicControls). For a
-- single curve, edge_control_dx/dy keep their 0034 meaning (the quadratic
-- control point's offset from the chord midpoint). Same base/zoom=1 pixel
-- units either way.
alter table book_graph_placement
  add column if not exists edge_control2_dx real,
  add column if not exists edge_control2_dy real;

alter table book_graph_placement
  add constraint book_graph_placement_control2_only_when_double check (
    (edge_control2_dx is null) = (edge_control2_dy is null)
    and (edge_control2_dx is null or (edge_curved and edge_control_dx is not null and edge_control_dy is not null))
  );
