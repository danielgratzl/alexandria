import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, User } from "lucide-react";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data } = useQuery<SearchResult>({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const hasResults =
    data && (data.books.length > 0 || data.authors.length > 0);

  return (
    <div ref={ref} className="relative w-full sm:max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search books & authors..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="pl-9"
      />
      {open && debouncedQuery.length >= 2 && (
        <div className="absolute top-full z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {!hasResults && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No results found
            </p>
          )}
          {data?.books.map((book) => (
            <button
              key={book.id}
              className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                navigate(`/books/${book.id}`);
                setOpen(false);
                setQuery("");
              }}
            >
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <span>{book.title}</span>
                {book.subtitle && (
                  <span className="text-muted-foreground">: {book.subtitle}</span>
                )}
                {book.authors.length > 0 && (
                  <p className="text-xs text-muted-foreground">{book.authors.map((a) => a.name).join(", ")}</p>
                )}
              </div>
            </button>
          ))}
          {data?.authors.map((author) => (
            <button
              key={author.id}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                navigate(`/authors/${author.id}`);
                setOpen(false);
                setQuery("");
              }}
            >
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{author.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
