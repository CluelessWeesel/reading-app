import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Distinct gateway_person/gateway_source values already on file (across
// both books and tbr), ranked by how often each was used -- lets
// GatewayPicker offer them as one-tap chips so a repeated answer ("Dad",
// "BookTube") never has to be retyped.
export async function GET() {
  const [people, sources] = await Promise.all([
    pool.query<{ value: string }>(
      `select gateway_person as value from (
         select gateway_person from books where gateway_person is not null
         union all
         select gateway_person from tbr where gateway_person is not null
       ) s group by gateway_person order by count(*) desc, gateway_person asc limit 12`
    ),
    pool.query<{ value: string }>(
      `select gateway_source as value from (
         select gateway_source from books where gateway_source is not null
         union all
         select gateway_source from tbr where gateway_source is not null
       ) s group by gateway_source order by count(*) desc, gateway_source asc limit 12`
    ),
  ]);
  return NextResponse.json({
    people: people.rows.map((r) => r.value),
    sources: sources.rows.map((r) => r.value),
  });
}
