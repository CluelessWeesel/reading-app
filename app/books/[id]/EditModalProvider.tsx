"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { EditBookModal } from "@/app/shared/EditBookModal";
import type { Book } from "@/app/shared/bookTypes";
import { ReviewModal } from "./ReviewModal";

const EditModalContext = createContext<(() => void) | null>(null);
const ReviewModalContext = createContext<(() => void) | null>(null);

export function useOpenEditModal(): () => void {
  const ctx = useContext(EditModalContext);
  if (!ctx) throw new Error("useOpenEditModal must be used within EditModalProvider");
  return ctx;
}

export function useOpenReviewModal(): () => void {
  const ctx = useContext(ReviewModalContext);
  if (!ctx) throw new Error("useOpenReviewModal must be used within EditModalProvider");
  return ctx;
}

// Lets the header's "Edit" button open the full edit modal, and the review
// section's own button open just a focused review editor -- both share this
// same book data and the same on-save behaviour (refresh the server render)
// while the rest of the page stays a plain server component.
export function EditModalProvider({
  book,
  allGenres,
  seriesOptions,
  subgenreOptions,
  children,
}: {
  book: Book;
  allGenres: string[];
  seriesOptions: string[];
  subgenreOptions: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  return (
    <EditModalContext.Provider value={() => setEditing(true)}>
      <ReviewModalContext.Provider value={() => setReviewing(true)}>
        {children}
        {editing && (
          <EditBookModal
            book={book}
            allGenres={allGenres}
            seriesOptions={seriesOptions}
            subgenreOptions={subgenreOptions}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
            onDeleted={() => router.push("/library")}
          />
        )}
        {reviewing && (
          <ReviewModal
            book={book}
            onClose={() => setReviewing(false)}
            onSaved={() => {
              setReviewing(false);
              router.refresh();
            }}
          />
        )}
      </ReviewModalContext.Provider>
    </EditModalContext.Provider>
  );
}
