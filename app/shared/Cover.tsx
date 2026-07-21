"use client";

import { useState, type MouseEvent } from "react";
import { fraunces } from "./fonts";
import { coverGradient } from "./coverPalette";

export function Cover({
  id,
  title,
  coverUrl,
  onCoverChange,
  apiPath,
  className = "aspect-[2/3] w-full",
  initialClassName = "text-4xl",
  roundedClassName = "rounded-md",
  fillClassName = "",
}: {
  id: number;
  title: string;
  coverUrl: string | null;
  onCoverChange: (id: number, coverUrl: string | null) => void;
  apiPath: string;
  className?: string;
  initialClassName?: string;
  roundedClassName?: string;
  // Letterboxing behind a cover whose real aspect ratio isn't exactly 2:3
  // (object-contain leaves gaps on some side). Transparent by default, so
  // whatever's behind the cover -- the card's own background -- shows
  // through rather than a mismatched solid-color patch; pass an explicit
  // color class here for the rare spot that wants one.
  fillClassName?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Give a newly-pasted (or newly-loaded) URL a fresh chance to load, without
  // deriving state in an effect (React's recommended "adjust state during
  // render" pattern for resetting state when a prop changes).
  const [trackedCoverUrl, setTrackedCoverUrl] = useState(coverUrl);
  if (coverUrl !== trackedCoverUrl) {
    setTrackedCoverUrl(coverUrl);
    setImageFailed(false);
  }

  const showImage = Boolean(coverUrl) && !imageFailed;

  async function handleEditCover(e: MouseEvent) {
    // Cover can be wrapped in a Link (e.g. Library's card view links the
    // whole cover to the book page) -- without this, clicking the pencil
    // would both open the prompt below AND navigate away.
    e.preventDefault();
    e.stopPropagation();

    const input = window.prompt("Paste a cover image URL (leave blank to clear):", coverUrl ?? "");
    if (input === null) return; // cancelled

    const next = input.trim() || null;
    const previous = coverUrl;
    onCoverChange(id, next); // optimistic
    setSaving(true);

    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_url: next }),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      onCoverChange(id, previous); // revert
      window.alert("Couldn't save that cover URL -- please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`group relative shrink-0 overflow-hidden ${roundedClassName} ${
        showImage
          ? fillClassName
          : `flex items-center justify-center bg-gradient-to-br shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${coverGradient(title)}`
      } ${className}`}
    >
      {showImage ? (
        // Cover URLs can come from Google Books, Open Library, or any URL you
        // paste in yourself -- an open set of hosts next/image's allow-list
        // can't accommodate, so this is a plain <img> with an error fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl as string}
          alt={`Cover of ${title}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <span className="absolute left-0 top-0 h-full w-1.5 bg-black/10 dark:bg-white/10" />
          <span className={`${fraunces.className} font-semibold text-black/25 dark:text-white/25 ${initialClassName}`}>
            {title.charAt(0)}
          </span>
          <span className="absolute inset-x-3 bottom-3 h-px bg-black/10 dark:bg-white/10" />
        </>
      )}

      <button
        type="button"
        onClick={handleEditCover}
        disabled={saving}
        aria-label={`Edit cover for ${title}`}
        className="absolute right-1 top-1 z-10 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] leading-tight text-white opacity-0 transition group-hover:opacity-70 hover:!opacity-100 focus-visible:opacity-100 disabled:opacity-40"
      >
        ✎
      </button>
    </div>
  );
}
