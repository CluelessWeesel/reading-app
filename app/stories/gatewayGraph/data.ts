import { pool } from "@/lib/db";
import type { GatewayBookRow, TbrGatewayRow } from "./math";
import type { BookPlacementRow, NodePlacementRow } from "./arrangeMath";

export async function getGatewayGraphRows(): Promise<GatewayBookRow[]> {
  const { rows } = await pool.query<GatewayBookRow>(
    `select book_id, title, author, cover_url, genre, score::float8 as score, page_count,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished,
            gateway_book_id, gateway_person, gateway_source,
            to_char(gateway_checked_at, 'YYYY-MM-DD"T"HH24:MI:SS') as gateway_checked_at
     from books`
  );
  return rows;
}

// Only TBR rows that already have a gateway captured -- an entry with none
// set has nothing to show here (filtered in SQL rather than fetching all
// ~800 rows and discarding most of them in JS).
export async function getGatewayGraphTbrRows(): Promise<TbrGatewayRow[]> {
  const { rows } = await pool.query<TbrGatewayRow>(
    `select id as tbr_id, title, author, cover_url, genre, page_count,
            to_char(created_at, 'YYYY-MM-DD') as created_at,
            gateway_book_id, gateway_person, gateway_source
     from tbr
     where gateway_book_id is not null or gateway_person is not null or gateway_source is not null`
  );
  return rows;
}

export async function getBookGraphPlacements(): Promise<BookPlacementRow[]> {
  const { rows } = await pool.query<BookPlacementRow>(
    `select book_id, x::float8 as x, edge_curved,
            edge_control_dx::float8 as edge_control_dx, edge_control_dy::float8 as edge_control_dy,
            edge_control2_dx::float8 as edge_control2_dx, edge_control2_dy::float8 as edge_control2_dy
     from book_graph_placement`
  );
  return rows;
}

export async function getGatewayNodePlacements(): Promise<NodePlacementRow[]> {
  const { rows } = await pool.query<NodePlacementRow>(
    `select node_key, x::float8 as x, y::float8 as y from gateway_node_placement`
  );
  return rows;
}
