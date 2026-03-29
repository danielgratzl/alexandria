import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BookListResponse } from "@/lib/api";
import { BookListItem } from "@/components/BookListItem";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";

export function Library() {
  const [page, setPage] = useState(1);
  const [format, setFormat] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.locations.list().then(setLocations);
  }, []);

  // Auto-show more filters if any extra filter is active
  const hasExtraFilters = !!(status || category || location);

  const { data, isLoading } = useQuery<BookListResponse>({
    queryKey: ["books", { page, format, status, category, location, sort, order }],
    queryFn: () =>
      api.books.list({
        page,
        format: format || undefined,
        status: status || undefined,
        category: category || undefined,
        location: location || undefined,
        sort,
        order,
      }),
  });

  function clearExtraFilters() {
    setStatus("");
    setCategory("");
    setLocation("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-2xl font-bold">Books</h1>
          {data && (
            <span className="text-sm text-muted-foreground">
              {data.pagination.total} {data.pagination.total === 1 ? "book" : "books"}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={format} onValueChange={(v) => { setFormat(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28 sm:w-32">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                <SelectItem value="book">Book</SelectItem>
                <SelectItem value="ebook">E-Book</SelectItem>
                <SelectItem value="audiobook">Audiobook</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sort}-${order}`} onValueChange={(v) => {
              const [s, o] = v.split("-");
              setSort(s);
              setOrder(o);
            }}>
              <SelectTrigger className="w-32 sm:w-40">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Newest first</SelectItem>
                <SelectItem value="created_at-asc">Oldest first</SelectItem>
                <SelectItem value="title-asc">Title A-Z</SelectItem>
                <SelectItem value="title-desc">Title Z-A</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showMoreFilters || hasExtraFilters ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowMoreFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {(showMoreFilters || hasExtraFilters) && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28 sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28 sm:w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="fiction">Fiction</SelectItem>
                <SelectItem value="non-fiction">Non-Fiction</SelectItem>
              </SelectContent>
            </Select>
            {locations.length > 0 && (
              <Select value={location || "all"} onValueChange={(v) => { setLocation(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-28 sm:w-36">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasExtraFilters && (
              <Button variant="ghost" size="sm" onClick={clearExtraFilters}>
                <X className="mr-1 h-3 w-3" />
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : data?.books.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>No books yet. Add your first book to get started.</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {data?.books.map((book) => (
              <BookListItem key={book.id} book={book} />
            ))}
          </div>

          {data && data.pagination.totalPages > 1 && (
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
