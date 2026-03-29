import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, bookCoverUrl, authorPhotoUrl } from "@/lib/api";
import { languageDisplayName } from "@shared/languages";
import type { Book, BookInput } from "@/lib/api";
import { BookForm } from "@/components/BookForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  Tablet,
  Pencil,
  Trash2,
} from "lucide-react";

const formatIcons = {
  book: BookOpen,
  ebook: Tablet,
  audiobook: Headphones,
};

export function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: book, isLoading } = useQuery<Book>({
    queryKey: ["book", id],
    queryFn: () => api.books.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: BookInput) => api.books.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", id] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book updated");
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.books.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book deleted");
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Book not found</p>
        <Button variant="link" asChild>
          <Link to="/">Back to library</Link>
        </Button>
      </div>
    );
  }

  const FormatIcon = formatIcons[book.format];

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Cancel
          </Button>
          <h1 className="text-2xl font-bold">Edit Book</h1>
        </div>
        <BookForm
          initialData={{
            title: book.title,
            subtitle: book.subtitle,
            isbn10: book.isbn10,
            isbn13: book.isbn13,
            language: book.language ?? "en",
            pageCount: book.pageCount,
            durationMinutes: book.durationMinutes,
            format: book.format,
            seriesName: book.seriesName,
            seriesPosition: book.seriesPosition,
            coverUrl: book.coverUrl,
            notes: book.notes,
            category: book.category,
            readStatus: book.readStatus,
            openlibraryKey: book.openlibraryKey,
            location: book.location,
            authors: book.authors,
          }}
          onSubmit={(data) => updateMutation.mutate(data)}
          submitLabel="Save Changes"
          loading={updateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Books
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        {bookCoverUrl(book.coverUrl) ? (
          <img
            src={bookCoverUrl(book.coverUrl)!}
            alt={book.title}
            className="h-40 w-auto shrink-0 self-start rounded-lg object-cover sm:h-64"
          />
        ) : (
          <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded-lg bg-muted sm:h-64 sm:w-44">
            <FormatIcon className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{book.title}</h1>
            {book.subtitle && (
              <p className="text-lg text-muted-foreground">{book.subtitle}</p>
            )}
            {book.authors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {book.authors.map((a) => (
                  <Link key={a.id} to={`/authors/${a.id}`} className="flex items-center gap-1.5 hover:underline">
                    {authorPhotoUrl(a.photoUrl) ? (
                      <img src={authorPhotoUrl(a.photoUrl)!} alt={a.name} className="h-6 w-6 rounded-full object-cover" />
                    ) : null}
                    <span className="text-lg text-muted-foreground">{a.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <FormatIcon className="mr-1 h-3 w-3" />
              {book.format}
            </Badge>
            <Badge variant="secondary">{book.readStatus}</Badge>
            {book.category && <Badge variant="outline">{book.category}</Badge>}
            {book.language && <Badge variant="outline">{languageDisplayName(book.language)}</Badge>}
          </div>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2 sm:gap-y-2">
            {book.isbn13 && (
              <>
                <dt className="text-muted-foreground">ISBN-13</dt>
                <dd>{book.isbn13}</dd>
              </>
            )}
            {book.isbn10 && (
              <>
                <dt className="text-muted-foreground">ISBN-10</dt>
                <dd>{book.isbn10}</dd>
              </>
            )}
            {book.format === "audiobook" && book.durationMinutes ? (
              <>
                <dt className="text-muted-foreground">Length</dt>
                <dd>{Math.floor(book.durationMinutes / 60)}h {book.durationMinutes % 60}m</dd>
              </>
            ) : book.pageCount ? (
              <>
                <dt className="text-muted-foreground">Pages</dt>
                <dd>{book.pageCount}</dd>
              </>
            ) : null}
            {book.seriesName && (
              <>
                <dt className="text-muted-foreground">Series</dt>
                <dd>
                  {book.seriesName}
                  {book.seriesPosition != null && ` #${book.seriesPosition}`}
                </dd>
              </>
            )}
            {book.location && (
              <>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{book.location}</dd>
              </>
            )}
          </dl>

          {book.notes && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-sm">{book.notes}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete book?</DialogTitle>
                  <DialogDescription>
                    This will permanently remove "{book.title}" from your library.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
