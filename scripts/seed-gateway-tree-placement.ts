// One-time seed for the drag-to-arrange gateway-tree view's manual
// placement tables (book_graph_placement, gateway_node_placement) --
// every CURRENTLY-traced book/root gets a reasonable starting X (and, for
// person/source roots, Y) derived from the existing bloodline layout, so
// the user isn't stuck manually placing ~400 historical books from a bare
// canvas. Anything traced AFTER this runs starts unplaced (shows in the
// "to place" tray) -- this script is meant to run exactly once.
//
// Reuses ONLY computeGatewayGraph + the per-bloodline in-tree x fractions
// it already computes (both pure, stable, proven across this feature's
// history) -- deliberately does NOT import WholeTreeByDate.tsx's lane
// logic (the file most implicated in recent layout bugs). Lane assignment
// here is its own small, disposable, one-time walk.
//
// TBR leaf nodes and true orphans are excluded entirely (not part of this
// view in v1). A book/root with literally no date anywhere in its own
// subtree (vanishingly rare) is skipped and reported, left for the user
// to place manually.
//
// Usage:
//   npm run seed:gateway-tree-placement            -- dry run, prints the report
//   npm run seed:gateway-tree-placement -- --write  -- applies in one transaction

import { config } from "dotenv";
import path from "node:path";
import { Pool } from "pg";
import { computeGatewayGraph, type GatewayBookRow } from "../app/stories/gatewayGraph/math";
import { dateToY, earliestDateInSubtree } from "../app/stories/gatewayGraph/arrangeMath";

config({ path: path.join(process.cwd(), ".env.local") });

const WRITE = process.argv.includes("--write");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

const MIN_BAND_WIDTH = 160;
const PX_PER_LEAF = 140;
const BAND_GAP = 80;

async function main() {
  const { rows } = await pool.query<GatewayBookRow>(
    `select book_id, title, author, cover_url, genre, score::float8 as score, page_count,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished,
            gateway_book_id, gateway_person, gateway_source,
            to_char(gateway_checked_at, 'YYYY-MM-DD"T"HH24:MI:SS') as gateway_checked_at
     from books`
  );

  // TBR rows deliberately omitted -- TBR leaves aren't seeded/placed in v1.
  const summary = computeGatewayGraph(rows, []);

  const bookSeeds: { book_id: number; x: number }[] = [];
  const nodeSeeds: { node_key: string; x: number; y: number }[] = [];
  let tbrSkipped = 0;
  let bookNoDateSkipped = 0;
  let rootNoDateSkipped = 0;

  let cursorX = 0;
  for (const bloodline of summary.bloodlines) {
    const bandWidth = Math.max(MIN_BAND_WIDTH, bloodline.leafCount * PX_PER_LEAF);
    const bandX0 = cursorX;
    cursorX += bandWidth + BAND_GAP;

    for (const layoutNode of bloodline.nodes) {
      const { node } = layoutNode;
      const seedX = bandX0 + layoutNode.x * bandWidth;

      if (node.kind === "book") {
        if (node.unread) {
          tbrSkipped++;
          continue;
        }
        const dateIso = node.dateFinished ?? earliestDateInSubtree(bloodline, node.key);
        if (!dateIso) {
          bookNoDateSkipped++;
          continue;
        }
        bookSeeds.push({ book_id: node.bookId, x: seedX });
      } else {
        // Only roots are ever non-book (person/source nodes can't have a
        // gateway themselves), so this is necessarily the bloodline's root.
        if (!bloodline.startDate) {
          rootNoDateSkipped++;
          continue;
        }
        nodeSeeds.push({ node_key: node.key, x: seedX, y: dateToY(bloodline.startDate) });
      }
    }
  }

  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));
  console.log(`Bloodlines: ${summary.bloodlines.length}`);
  console.log(`Books to seed: ${bookSeeds.length}`);
  console.log(`Roots (person/source) to seed: ${nodeSeeds.length}`);
  console.log(`TBR leaves skipped (not part of this view): ${tbrSkipped}`);
  console.log(`Books skipped (no date anywhere in subtree): ${bookNoDateSkipped}`);
  console.log(`Roots skipped (no dated descendant in bloodline): ${rootNoDateSkipped}`);

  const xCounts = new Map<string, number>();
  for (const b of bookSeeds) {
    const k = b.x.toFixed(1);
    xCounts.set(k, (xCounts.get(k) ?? 0) + 1);
  }
  const collisions = Array.from(xCounts.values()).filter((n) => n > 1).length;
  console.log(`Duplicate-X collisions among seeded books (expected for single-leaf bloodlines): ${collisions}`);

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const b of bookSeeds) {
      await client.query(
        `insert into book_graph_placement (book_id, x) values ($1, $2) on conflict (book_id) do update set x = excluded.x`,
        [b.book_id, b.x]
      );
    }
    for (const n of nodeSeeds) {
      await client.query(
        `insert into gateway_node_placement (node_key, x, y) values ($1, $2, $3) on conflict (node_key) do update set x = excluded.x, y = excluded.y`,
        [n.node_key, n.x, n.y]
      );
    }
    await client.query("COMMIT");
    console.log("\nAll changes committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
