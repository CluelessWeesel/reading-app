"use client";

import { useState } from "react";
import { fraunces } from "./fonts";
import { coverGradient } from "./coverPalette";
import type { Book } from "./types";

export function Cover({
  book,
  onCoverChange,
  className = "aspect-[2/3] w-full",
  initialClassName = "text-4xl",
}: {
  book: Book;
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
  className?: string;
  initialClassName?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Give a newly-pasted (or newly-loaded) URL a fresh chance to load, without
  // deriving state in an effect (React's recommended "adjust state during
  // render" pattern for resetting state when a prop changes).
  const [trackedCoverUrl, setTrackedCoverUrl] = useState(book.cover_url);
  if (book.cover_url !== trackedCoverUrl) {
    setTrackedCoverUrl(book.cover_url);
    setImageFailed(false);
  }

  const showImage = Boolean(book.cover_url) && !imageFailed;

  async function handleEditCover() {
    const input = window.prompt(
      "Paste a cover image URL (leave blank to clear):",
      book.cover_url ?? ""
    );
    if (input === null) return; // cancelled

    const next = input.trim() || null;
    const previous = book.cover_url;
    onCoverChange(book.book_id, next); // optimistic
    setSaving(true);

    try {
      const res = await fetch(`/api/books/${book.book_id}/cover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_url: next }),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      onCoverChange(book.book_id, previous); // revert
      window.alert("Couldn't save that cover URL -- please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`group relative shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${
        showImage
          ? "bg-paper"
          : `flex items-center justify-center bg-gradient-to-br ${coverGradient(book.title)}`
      } ${className}`}
    >
      {showImage ? (
        // Cover URLs can come from Google Books, Open Library, or any URL you
        // paste in yourself -- an open set of hosts next/image's allow-list
        // can't accommodate, so this is a plain <img> with an error fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover_url as string}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <span className="absolute left-0 top-0 h-full w-1.5 bg-black/10 dark:bg-white/10" />
          <span className={`${fraunces.className} font-semibold text-black/25 dark:text-white/25 ${initialClassName}`}>
            {book.title.charAt(0)}
          </span>
          <span className="absolute inset-x-3 bottom-3 h-px bg-black/10 dark:bg-white/10" />
        </>
      )}

      <button
        type="button"
        onClick={handleEditCover}
        disabled={saving}
        aria-label={`Edit cover for ${book.title}`}
        className="absolute right-1 top-1 z-10 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] leading-tight text-white opacity-0 transition group-hover:opacity-70 hover:!opacity-100 focus-visible:opacity-100 disabled:opacity-40"
      >
        ✎
      </button>
    </div>
  );
}
