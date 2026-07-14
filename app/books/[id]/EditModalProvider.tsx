"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { EditBookModal } from "@/app/shared/EditBookModal";
import type { Book } from "@/app/shared/bookTypes";

const EditModalContext = createContext<(() => void) | null>(null);

export function useOpenEditModal(): () => void {
  const ctx = useContext(EditModalContext);
  if (!ctx) throw new Error("useOpenEditModal must be used within EditModalProvider");
  return ctx;
}

// Lets both the header's "Edit" button and the review section's empty-state
// link open the same modal, while keeping the rest of the page (which reads
// this same book data server-side) plain server components -- on save/delete
// it just refreshes the server render rather than mirroring state client-side.
export function EditModalProvider({
  book,
  allGenres,
  seriesOptions,
  children,
}: {
  book: Book;
  allGenres: string[];
  seriesOptions: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <EditModalContext.Provider value={() => setEditing(true)}>
      {children}
      {editing && (
        <EditBookModal
          book={book}
          allGenres={allGenres}
          seriesOptions={seriesOptions}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
          onDeleted={() => router.push("/library")}
        />
      )}
    </EditModalContext.Provider>
  );
}
