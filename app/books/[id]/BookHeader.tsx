"use client";

import Link from "next/link";
import { useState } from "react";
import { Cover } from "@/app/shared/Cover";
import { StarRating } from "@/app/library/StarRating";
import { fraunces } from "@/app/shared/fonts";
import { HonourBadge } from "@/app/shared/HonourBadge";
import type { HonourItem } from "@/app/shared/HonourBadge";
import type { Book } from "@/app/shared/bookTypes";
import type { PredictedScoreResult } from "@/lib/predictedScore";
import { EditTrigger } from "./EditTrigger";

export function BookHeader({
  book,
  rankingInfo,
  modelPrediction,
  honours,
}: {
  book: Book;
  rankingInfo: { badge: string; background: string; color: string } | null;
  modelPrediction: PredictedScoreResult | null;
  honours: HonourItem[];
}) {
  const [coverUrl, setCoverUrl] = useState(book.cover_url);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <Cover
        id={book.book_id}
        title={book.title}
        coverUrl={coverUrl}
        onCoverChange={(_id, url) => setCoverUrl(url)}
        apiPath={`/api/books/${book.book_id}/cover`}
        className="aspect-[2/3] w-24 sm:w-28"
        initialClassName="text-2xl"
        roundedClassName="rounded-xl"
      />

      <div className="min-w-[220px] flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink`}>{book.title}</h1>
          {rankingInfo && (
            <span
              className="rounded-full px-2.5 py-0.5 text-sm font-medium"
              style={{ background: rankingInfo.background, color: rankingInfo.color }}
            >
              {rankingInfo.badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-ink-muted">
          {book.author_id != null ? (
            <Link href={`/authors/${book.author_id}`} className="hover:underline">
              {book.author}
            </Link>
          ) : (
            book.author ?? "Unknown author"
          )}
          {book.series && (
            <>
              {" · "}
              {book.series}
              {book.series_number != null ? ` #${book.series_number}` : ""}
            </>
          )}
        </p>

        {honours.length > 0 && (
          <div className="mt-1">
            <HonourBadge items={honours} />
          </div>
        )}

        <EditTrigger className="mt-3 rounded-full border border-hairline px-3 py-1 text-xs text-ink-muted hover:text-ink">
          Edit
        </EditTrigger>
      </div>

      <div className="shrink-0 text-right">
        {book.score != null && (
          <div className={`${fraunces.className} text-3xl font-semibold text-ink`}>{book.score.toFixed(1)}</div>
        )}
        <div className={book.score != null ? "mt-1" : ""}>
          <StarRating score={book.score} />
        </div>
        {(book.predicted_score != null || modelPrediction) && (
          <div className="mt-2 space-y-0.5 text-xs text-ink-faint">
            {book.predicted_score != null && (
              <p>
                your predicted {book.predicted_score.toFixed(1)}
                {book.predicted_margin != null ? ` · ±${book.predicted_margin.toFixed(1)}` : ""}
              </p>
            )}
            {modelPrediction && (
              <p>
                model estimate {modelPrediction.score.toFixed(1)} · ±{modelPrediction.margin.toFixed(1)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
