"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fraunces } from "../shared/fonts";
import { CoverThumb } from "../shared/CoverThumb";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { formatDateShort } from "../shared/formatDateShort";
import { formatPositionLabel } from "../shared/positionMath";
import { extractDominantColorFromImage, FALLBACK_DEEP_COLOR } from "./dominantColor";
import type { RightNowBook } from "./types";

// One "altar" panel for a book currently being read. Background is that
// book's own sampled cover color (extracted once client-side, then cached
// server-side on current_books.dominant_color so later visits/renders don't
// re-extract it) -- never a ranking between the two panels, just whichever
// two books are in current_books, in the same neutral order the query
// already returns them in.
export function CurrentBookAltar({ book }: { book: RightNowBook }) {
  const [color, setColor] = useState(book.dominant_color ?? FALLBACK_DEEP_COLOR);

  useEffect(() => {
    if (book.dominant_color || !book.cover_url) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const extracted = extractDominantColorFromImage(img);
      if (!extracted) return; // tainted canvas or similar -- keep the fallback
      setColor(extracted);
      fetch(`/api/current-books/${book.book_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dominant_color: extracted }),
      }).catch(() => {
        // Best-effort cache -- a failed write just means the next visitor
        // re-extracts instead of reading a cached value. Not worth surfacing.
      });
    };
    img.onerror = () => {
      // Cover URL is dead/unreachable -- keep the fallback color rather
      // than retry.
    };
    img.src = book.cover_url;

    return () => {
      cancelled = true;
    };
  }, [book.book_id, book.cover_url, book.dominant_color]);

  const formatLabel = book.format_type ? FORMAT_LABELS[book.format_type] ?? book.format_type : null;

  return (
    <Link
      href={`/books/${book.book_id}`}
      className="group flex flex-col items-center rounded-2xl p-6 text-center transition duration-180 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-card-lift)] sm:p-8"
      style={{ backgroundColor: color }}
    >
      <CoverThumb
        title={book.title}
        coverUrl={book.cover_url}
        className="aspect-[2/3] w-32 drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)] sm:w-40"
      />

      <p className={`${fraunces.className} mt-5 text-xl font-semibold text-[#f3e5ce] sm:text-2xl`}>{book.title}</p>
      <p className="mt-1 text-sm italic text-[#f3e5ce]/70">
        {book.author ?? "Unknown author"}
        {formatLabel && ` · ${formatLabel}`}
      </p>

      <div className="mt-5 w-full max-w-56">
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full bg-accent-green transition-[width] duration-300"
            style={{ width: `${book.percent}%`, boxShadow: "0 0 10px var(--accent-green)" }}
          />
        </div>
        <p className="mt-2 text-xs text-[#f3e5ce]/70">
          {formatPositionLabel(book.position, book.format_type, book.page_count)}
          {book.estFinish && ` · est. ${formatDateShort(book.estFinish)}`}
        </p>
      </div>
    </Link>
  );
}
