"use client";

import { useState } from "react";
import { Cover } from "@/app/shared/Cover";
import { fraunces } from "@/app/shared/fonts";
import { formatDateShort } from "@/app/shared/formatDateShort";
import { HonourBadge } from "@/app/shared/HonourBadge";
import { ordinal } from "@/app/books/[id]/format";
import type { WeeselRow } from "./types";

export function AuthorHeader({
  author,
  booksCount,
  totalPages,
  totalWords,
  avgScore,
  firstRead,
  latestRead,
  rankByPages,
  totalAuthors,
  percentileByPages,
  rankByScore,
  totalAuthorsByScore,
  percentileByScore,
  percentOfEverything,
  weesels,
}: {
  author: { id: number; name: string; photo_url: string | null };
  booksCount: number;
  totalPages: number;
  totalWords: number;
  avgScore: number | null;
  firstRead: string | null;
  latestRead: string | null;
  rankByPages: number | null;
  totalAuthors: number;
  percentileByPages: number | null;
  rankByScore: number | null;
  totalAuthorsByScore: number;
  percentileByScore: number | null;
  percentOfEverything: number | null;
  weesels: WeeselRow[];
}) {
  const [photoUrl, setPhotoUrl] = useState(author.photo_url);

  const vitalsParts = [
    `${booksCount} book${booksCount === 1 ? "" : "s"}`,
    totalPages > 0 ? `${totalPages.toLocaleString()} pages` : null,
    totalWords > 0 ? `${Math.round(totalWords).toLocaleString()} words` : null,
    avgScore != null ? `${avgScore.toFixed(1)} avg` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <Cover
        id={author.id}
        title={author.name}
        coverUrl={photoUrl}
        onCoverChange={(_id, url) => setPhotoUrl(url)}
        apiPath={`/api/authors/${author.id}/photo`}
        className="aspect-square w-28 sm:w-32"
        initialClassName="text-3xl"
        roundedClassName="rounded-full"
      />

      <div className="min-w-[220px] flex-1">
        <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>{author.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {vitalsParts.join(" · ")}
          {firstRead && latestRead && ` · ${formatDateShort(firstRead)} → ${formatDateShort(latestRead)}`}
        </p>

        {(rankByPages != null || percentOfEverything != null) && (
          <p className="mt-2 text-xs text-ink-faint">
            {rankByPages != null && `Your ${ordinal(rankByPages)} of ${totalAuthors} by pages`}
            {rankByPages != null && percentileByPages != null && ` (${ordinal(Math.round(percentileByPages * 100))} percentile)`}
            {rankByPages != null && percentOfEverything != null && " · "}
            {percentOfEverything != null && `${percentOfEverything.toFixed(1)}% of everything you've read`}
          </p>
        )}

        {rankByScore != null && (
          <p className="mt-1 text-xs text-ink-faint">
            {`Your ${ordinal(rankByScore)} of ${totalAuthorsByScore} by rating`}
            {percentileByScore != null && ` (${ordinal(Math.round(percentileByScore * 100))} percentile)`}
          </p>
        )}

        {weesels.length > 0 && (
          <div className="mt-1">
            <HonourBadge items={weesels} />
          </div>
        )}
      </div>
    </div>
  );
}
