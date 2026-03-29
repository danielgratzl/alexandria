const BASE = "/api";

export function bookCoverUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `${BASE}/covers/books/${filename}`;
}

export function authorPhotoUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `${BASE}/covers/authors/${filename}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// Types
export interface BookAuthor {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  isbn10: string | null;
  isbn13: string | null;
  language: string | null;
  pageCount: number | null;
  durationMinutes: number | null;
  format: "book" | "ebook" | "audiobook";
  seriesName: string | null;
  seriesPosition: number | null;
  coverUrl: string | null;
  notes: string | null;
  category: "fiction" | "non-fiction" | null;
  readStatus: "unread" | "reading" | "read";
  openlibraryKey: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  authors: BookAuthor[];
}

export interface BookListResponse {
  books: Book[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Author {
  id: string;
  name: string;
  photoUrl: string | null;
  openlibraryKey: string | null;
  bookCount: number;
}

export interface AuthorListResponse {
  authors: Author[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthorDetail extends Omit<Author, "bookCount"> {
  books: {
    id: string;
    title: string;
    subtitle: string | null;
    format: string;
    coverUrl: string | null;
    readStatus: string;
    seriesName: string | null;
    seriesPosition: number | null;
  }[];
}

export interface OpenLibraryResult {
  title: string;
  subtitle?: string;
  authors: { name: string; openlibraryKey?: string }[];
  isbn10?: string;
  isbn13?: string;
  language?: string;
  pageCount?: number;
  coverUrl?: string;
  seriesName?: string;
  openlibraryKey?: string;
}

export interface SearchResult {
  books: Book[];
  authors: { id: string; name: string; openlibraryKey: string | null }[];
}

export interface OpenLibrarySearchItem {
  title: string;
  authors: string[];
  isbn?: string;
  coverUrl?: string;
  firstPublishYear?: number;
  openlibraryKey: string;
}

export interface BookInput {
  title: string;
  subtitle?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  language?: string;
  pageCount?: number | null;
  durationMinutes?: number | null;
  format?: "book" | "ebook" | "audiobook";
  seriesName?: string | null;
  seriesPosition?: number | null;
  coverUrl?: string | null;
  notes?: string | null;
  category?: "fiction" | "non-fiction" | null;
  readStatus?: "unread" | "reading" | "read";
  openlibraryKey?: string | null;
  location?: string | null;
  authors?: { name: string; openlibraryKey?: string }[];
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthStatus {
  user: AuthUser;
  needsPassword: boolean;
}

// API
export const api = {
  auth: {
    me() {
      return request<AuthStatus>("/auth/me");
    },
    login(username: string, password: string) {
      return request<{ user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    },
    logout() {
      return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
    },
    setup(password: string) {
      return request<{ user: AuthUser }>("/auth/setup", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
    },
  },
  books: {
    list(params?: {
      page?: number;
      limit?: number;
      format?: string;
      status?: string;
      category?: string;
      location?: string;
      sort?: string;
      order?: string;
    }) {
      const searchParams = new URLSearchParams();
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== "") searchParams.set(k, String(v));
        }
      }
      const qs = searchParams.toString();
      return request<BookListResponse>(`/books${qs ? `?${qs}` : ""}`);
    },
    get(id: string) {
      return request<Book>(`/books/${id}`);
    },
    create(data: BookInput) {
      return request<Book>("/books", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    update(id: string, data: Partial<BookInput>) {
      return request<Book>(`/books/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    delete(id: string) {
      return request<{ ok: boolean }>(`/books/${id}`, { method: "DELETE" });
    },
  },
  authors: {
    list(params?: { page?: number; limit?: number }) {
      const searchParams = new URLSearchParams();
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) searchParams.set(k, String(v));
        }
      }
      const qs = searchParams.toString();
      return request<AuthorListResponse>(`/authors${qs ? `?${qs}` : ""}`);
    },
    get(id: string) {
      return request<AuthorDetail>(`/authors/${id}`);
    },
    update(id: string, data: { name?: string; photoUrl?: string | null }) {
      return request<Author>(`/authors/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    delete(id: string) {
      return request<{ ok: boolean }>(`/authors/${id}`, { method: "DELETE" });
    },
  },
  search(q: string) {
    return request<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
  },
  lookup: {
    isbn(isbn: string) {
      return request<OpenLibraryResult>(`/lookup/isbn/${encodeURIComponent(isbn)}`);
    },
    search(q: string) {
      return request<OpenLibrarySearchItem[]>(`/lookup/search?q=${encodeURIComponent(q)}`);
    },
  },
  locations: {
    list() {
      return request<{ id: string; name: string }[]>("/locations");
    },
  },
  import: {
    url: `${BASE}/import`,
  },
  stats() {
    return request<{
      totals: { books: number; authors: number; locations: number; pages: number; minutes: number };
      recentlyAdded: number;
      byFormat: { format: string; count: number }[];
      byStatus: { status: string; count: number }[];
      byCategory: { category: string; count: number }[];
      byLocation: { location: string; count: number }[];
      topAuthors: { name: string; photoUrl: string | null; count: number }[];
      byLanguage: { language: string; count: number }[];
      topSeries: { name: string; count: number }[];
    }>("/stats");
  },
  covers: {
    async upload(type: "books" | "authors", file: File): Promise<string> {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/covers/upload/${type}`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { filename: string };
      return data.filename;
    },
  },
};
