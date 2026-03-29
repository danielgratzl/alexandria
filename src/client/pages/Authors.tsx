import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, authorPhotoUrl } from "@/lib/api";
import type { AuthorListResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { User, ChevronLeft, ChevronRight } from "lucide-react";

function AuthorAvatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const src = authorPhotoUrl(photoUrl);
  if (src) {
    return <img src={src} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
      <User className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

export function Authors() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<AuthorListResponse>({
    queryKey: ["authors", { page }],
    queryFn: () => api.authors.list({ page }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Authors</h1>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Authors</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.pagination.total} total
          </span>
        )}
      </div>

      {!data || data.authors.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No authors yet. Add books to see authors here.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {data.authors.map((author) => (
              <Link
                key={author.id}
                to={`/authors/${author.id}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <AuthorAvatar photoUrl={author.photoUrl} name={author.name} />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{author.name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {author.bookCount} {author.bookCount === 1 ? "book" : "books"}
                </span>
              </Link>
            ))}
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
