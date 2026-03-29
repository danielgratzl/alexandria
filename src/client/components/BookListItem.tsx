import { Link } from "react-router-dom";
import { bookCoverUrl, type Book } from "@/lib/api";
import { BookOpen, Headphones, Tablet } from "lucide-react";

const formatIcons = {
  book: BookOpen,
  ebook: Tablet,
  audiobook: Headphones,
};

function formatLength(book: Book): string | null {
  if (book.format === "audiobook" && book.durationMinutes) {
    const h = Math.floor(book.durationMinutes / 60);
    const m = book.durationMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  if (book.pageCount) return `${book.pageCount} pp`;
  return null;
}

export function BookListItem({ book }: { book: Book }) {
  const FormatIcon = formatIcons[book.format];
  const length = formatLength(book);

  return (
    <Link
      to={`/books/${book.id}`}
      className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-accent/50"
    >
      {bookCoverUrl(book.coverUrl) ? (
        <img
          src={bookCoverUrl(book.coverUrl)!}
          alt={book.title}
          className="h-10 w-7 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-muted">
          <FormatIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {book.title}
          {book.subtitle && <span className="font-normal text-muted-foreground">: {book.subtitle}</span>}
        </p>
        {book.authors.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {book.authors.map((a) => a.name).join(", ")}
          </p>
        )}
      </div>
      {length && (
        <span className="shrink-0 text-xs text-muted-foreground">{length}</span>
      )}
    </Link>
  );
}
