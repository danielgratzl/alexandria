import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { books, authors, bookAuthors } from "../db/schema.js";

const app = new Hono();

interface RawBookRow {
  id: string;
  title: string;
  subtitle: string | null;
  isbn_10: string | null;
  isbn_13: string | null;
  language: string | null;
  page_count: number | null;
  duration_minutes: number | null;
  format: string;
  series_name: string | null;
  series_position: number | null;
  cover_url: string | null;
  notes: string | null;
  category: string | null;
  read_status: string;
  openlibrary_key: string | null;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  rank: number;
}

function mapBookRow(row: RawBookRow) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    isbn10: row.isbn_10,
    isbn13: row.isbn_13,
    language: row.language,
    pageCount: row.page_count,
    durationMinutes: row.duration_minutes,
    format: row.format,
    seriesName: row.series_name,
    seriesPosition: row.series_position,
    coverUrl: row.cover_url,
    notes: row.notes,
    category: row.category,
    readStatus: row.read_status,
    openlibraryKey: row.openlibrary_key,
    location: row.location_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get("/", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ books: [], authors: [] });

  // Escape FTS5 special characters and add prefix matching
  const ftsQuery = q
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(" ");

  // Search books via FTS5
  const matchingBooks = await db.all(
    sql`SELECT b.*, l.name as location_name, books_fts.rank
        FROM books_fts
        JOIN books b ON b.id = books_fts.book_id
        LEFT JOIN locations l ON l.id = b.location_id
        WHERE books_fts MATCH ${ftsQuery}
        ORDER BY books_fts.rank
        LIMIT 50`
  ) as RawBookRow[];

  // Fetch authors for matching books
  const bookIds = matchingBooks.map((b) => b.id);
  const bookAuthorRows = bookIds.length > 0
    ? await db
        .select({
          bookId: bookAuthors.bookId,
          authorId: authors.id,
          authorName: authors.name,
          authorPhotoUrl: authors.photoUrl,
        })
        .from(bookAuthors)
        .innerJoin(authors, eq(bookAuthors.authorId, authors.id))
        .where(sql`${bookAuthors.bookId} IN (${sql.join(bookIds.map(id => sql`${id}`), sql`, `)})`)
    : [];

  const authorsByBook = new Map<string, { id: string; name: string; photoUrl: string | null }[]>();
  for (const row of bookAuthorRows) {
    if (!authorsByBook.has(row.bookId)) authorsByBook.set(row.bookId, []);
    authorsByBook.get(row.bookId)!.push({ id: row.authorId, name: row.authorName, photoUrl: row.authorPhotoUrl });
  }

  const booksWithAuthors = matchingBooks.map((row) => ({
    ...mapBookRow(row),
    authors: authorsByBook.get(row.id) ?? [],
  }));

  // Search authors by name
  const matchingAuthors = await db
    .select()
    .from(authors)
    .where(sql`${authors.name} LIKE ${'%' + q + '%'}`)
    .limit(20);

  return c.json({
    books: booksWithAuthors,
    authors: matchingAuthors,
  });
});

export default app;
