import { pool } from "@/lib/db";
import { LogView } from "./LogView";
import type { CurrentBookForLog, DailyReadingRow } from "./types";

export const dynamic = "force-dynamic";

async function getCurrentBooks(): Promise<CurrentBookForLog[]> {
  const { rows } = await pool.query<CurrentBookForLog>(
    `select
       cb.book_id, cb.position::float8 as position,
       b.title, b.author, b.format_type, b.page_count, b.cover_url,
       to_char(b.date_started, 'YYYY-MM-DD') as date_started,
       to_char((select max(date) from daily_reading where book_id = cb.book_id), 'YYYY-MM-DD') as last_log_date
     from current_books cb
     join books b on b.book_id = cb.book_id
     order by b.format_type, b.title`
  );
  return rows;
}

async function getRecentDailyReading(): Promise<DailyReadingRow[]> {
  const { rows } = await pool.query<DailyReadingRow>(
    `select
       dr.id, dr.book_id, dr.pages,
       to_char(dr.date, 'YYYY-MM-DD') as date,
       b.title as book_title
     from daily_reading dr
     left join books b on b.book_id = dr.book_id
     where dr.date >= current_date - interval '30 days'
     order by dr.date desc, b.title asc nulls last`
  );
  return rows;
}

export default async function LogPage() {
  const [currentBooks, recentRows] = await Promise.all([
    getCurrentBooks(),
    getRecentDailyReading(),
  ]);
  return <LogView currentBooks={currentBooks} recentRows={recentRows} />;
}
