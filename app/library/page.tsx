import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

type Book = {
  book_id: number;
  title: string;
  author: string;
  series: string | null;
  series_number: number | null;
  year_read: number;
  score: number | null;
};

async function getBooks(): Promise<Book[]> {
  const { rows } = await pool.query<Book>(
    `select book_id, title, author, series, series_number, year_read, score
     from books
     order by title asc`
  );
  return rows;
}

export default async function LibraryPage() {
  const books = await getBooks();

  return (
    <div className="min-h-full flex-1 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-2xl font-semibold text-black dark:text-zinc-50">
          Library{" "}
          <span className="text-base font-normal text-zinc-500">
            ({books.length} books)
          </span>
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <div
              key={book.book_id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2 className="font-medium text-black dark:text-zinc-50">
                {book.title}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {book.author}
              </p>
              {book.series && (
                <p className="mt-1 text-sm text-zinc-500">
                  {book.series}
                  {book.series_number != null ? ` #${book.series_number}` : ""}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
                <span>{book.year_read}</span>
                <span>{book.score != null ? `★ ${book.score}` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
