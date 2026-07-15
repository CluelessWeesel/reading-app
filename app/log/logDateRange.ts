import { addIsoDays } from "../shared/isoDate";
import type { CurrentBookForLog } from "./types";

export function rangeStartFor(book: CurrentBookForLog): string | null {
  if (book.last_log_date) return addIsoDays(book.last_log_date, 1);
  return book.date_started;
}
