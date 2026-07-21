"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rankColor } from "@/app/books/[id]/rankColor";
import { StarRating } from "@/app/library/StarRating";
import { CoverThumb } from "@/app/shared/CoverThumb";
import type { AuthorBook, RankingInfo } from "./types";

type Order = "reading" | "publication";

export function Bookshelf({ books, rankings }: { books: AuthorBook[]; rankings: Record<number, RankingInfo> }) {
  const [order, setOrder] = useState<Order>("reading");

  // `books` already arrives in date_finished asc order (reading order) from
  // the page's query -- publication order just re-sorts by year_released,
  // pushing undated books to the end rather than breaking the order.
  const sorted = useMemo(() => {
    if (order === "reading") return books;
    return [...books].sort((a, b) => (a.year_released ?? Infinity) - (b.year_released ?? Infinity));
  }, [books, order]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOrder("reading")}
          aria-pressed={order === "reading"}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            order === "reading" ? "bg-accent text-on-accent" : "border border-gold text-ink-warm-muted hover:bg-hover"
          }`}
        >
          Reading order
        </button>
        <button
          type="button"
          onClick={() => setOrder("publication")}
          aria-pressed={order === "publication"}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            order === "publication" ? "bg-accent text-on-accent" : "border border-gold text-ink-warm-muted hover:bg-hover"
          }`}
        >
          Publication order
        </button>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
        {sorted.map((book) => {
          const ranking = rankings[book.book_id];
          const badge = ranking ? rankColor(ranking.rank, ranking.total) : null;
          return (
            <Link key={book.book_id} href={`/books/${book.book_id}`} className="group flex flex-col gap-1">
              <div className="relative">
                <CoverThumb title={book.title} coverUrl={book.cover_url} className="aspect-[2/3] w-full" />
                {badge && (
                  <span
                    className="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
                    style={{ background: badge.background, color: badge.color }}
                  >
                    #{ranking.rank}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-ink-warm group-hover:underline">{book.title}</p>
              <StarRating score={book.score} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
