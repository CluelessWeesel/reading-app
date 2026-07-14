import Link from "next/link";
import { fraunces } from "@/app/shared/fonts";
import type { AuthorBook, PromptAnswer } from "./types";

function excerpt(text: string, max = 320): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

export function YourWords({ books, promptAnswers }: { books: AuthorBook[]; promptAnswers: PromptAnswer[] }) {
  const reviews = books.filter((b) => b.review && b.review.trim());
  const legacyNotes = books.filter((b) => b.legacy_notes && b.legacy_notes.trim());

  if (reviews.length === 0 && promptAnswers.length === 0 && legacyNotes.length === 0) return null;

  return (
    <div>
      <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink`}>Your words</h2>
      <div className="space-y-4">
        {reviews.map((b) => (
          <div key={`review-${b.book_id}`} className="rounded-xl border border-hairline bg-card/40 p-4">
            <Link href={`/books/${b.book_id}`} className="text-sm font-semibold text-ink hover:underline">
              {b.title}
            </Link>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{excerpt(b.review as string)}</p>
          </div>
        ))}

        {promptAnswers.map((pa) => (
          <div key={`prompt-${pa.book_id}-${pa.question}`} className="rounded-xl border border-hairline bg-card/40 p-4">
            <Link href={`/books/${pa.book_id}`} className="text-sm font-semibold text-ink hover:underline">
              {pa.book_title}
            </Link>
            <p className="mt-1 text-xs text-ink-faint">{pa.question}</p>
            <p className="mt-1 text-sm text-ink-muted">{pa.answer}</p>
          </div>
        ))}

        {legacyNotes.length > 0 && (
          <div className="rounded-xl border border-hairline bg-card/40 p-4">
            <h3 className={`${fraunces.className} mb-2 text-sm font-semibold text-ink`}>From the archive</h3>
            {legacyNotes.map((b) => (
              <div key={`legacy-${b.book_id}`} className="mb-3 last:mb-0">
                <Link
                  href={`/books/${b.book_id}`}
                  className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
                >
                  {b.title}
                </Link>
                <p className="whitespace-pre-wrap text-sm text-ink-faint">{b.legacy_notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
