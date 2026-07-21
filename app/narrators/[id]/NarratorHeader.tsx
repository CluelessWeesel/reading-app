"use client";

import { useState } from "react";
import { Cover } from "@/app/shared/Cover";
import { fraunces } from "@/app/shared/fonts";
import { formatDateShort } from "@/app/shared/formatDateShort";
import { HonourBadge } from "@/app/shared/HonourBadge";
import { ordinal } from "@/app/books/[id]/format";
import type { WeeselRow } from "@/app/authors/[id]/types";

export function NarratorHeader({
  narrator,
  booksCount,
  totalPages,
  avgScore,
  firstRead,
  latestRead,
  hoursInYourEars,
  rankByPages,
  totalNarrators,
  percentileByPages,
  percentOfEverything,
  weesels,
}: {
  narrator: { id: number; name: string; photo_url: string | null };
  booksCount: number;
  totalPages: number;
  avgScore: number | null;
  firstRead: string | null;
  latestRead: string | null;
  hoursInYourEars: number | null;
  rankByPages: number | null;
  totalNarrators: number;
  percentileByPages: number | null;
  percentOfEverything: number | null;
  weesels: WeeselRow[];
}) {
  const [photoUrl, setPhotoUrl] = useState(narrator.photo_url);

  const vitalsParts = [
    `${booksCount} book${booksCount === 1 ? "" : "s"}`,
    totalPages > 0 ? `${totalPages.toLocaleString()} pages` : null,
    hoursInYourEars != null ? `${hoursInYourEars.toFixed(1)}h in your ears` : null,
    avgScore != null ? `${avgScore.toFixed(2)} avg` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <Cover
        id={narrator.id}
        title={narrator.name}
        coverUrl={photoUrl}
        onCoverChange={(_id, url) => setPhotoUrl(url)}
        apiPath={`/api/narrators/${narrator.id}/photo`}
        className="aspect-square w-28 sm:w-32"
        initialClassName="text-3xl"
        roundedClassName="rounded-full"
      />

      <div className="min-w-[220px] flex-1">
        <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>{narrator.name}</h1>
        <p className="mt-1 text-sm text-ink-warm-muted">
          {vitalsParts.join(" · ")}
          {firstRead && latestRead && ` · ${formatDateShort(firstRead)} → ${formatDateShort(latestRead)}`}
        </p>

        {(rankByPages != null || percentOfEverything != null) && (
          <p className="mt-2 text-xs text-ink-warm-faint">
            {rankByPages != null && `Your ${ordinal(rankByPages)} of ${totalNarrators} by pages`}
            {rankByPages != null && percentileByPages != null && ` (${ordinal(Math.round(percentileByPages * 100))} percentile)`}
            {rankByPages != null && percentOfEverything != null && " · "}
            {percentOfEverything != null && `${percentOfEverything.toFixed(1)}% of everything you've read`}
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
