import { Hono } from "hono";
import { eq, sql, desc, asc, and } from "drizzle-orm";
import { db, updateFtsEntry, deleteFtsEntry } from "../db/index.js";
import { books, authors, bookAuthors, locations } from "../db/schema.js";
import { downloadCover, deleteCoverFile } from "../services/covers.js";

const app = new Hono();

async function resolveLocationId(locationName: string | null | undefined): Promise<string | null> {
  if (!locationName) return null;
  const name = locationName.trim();
  if (!name) return null;
  let loc = await db.select().from(locations).where(eq(locations.name, name)).get();
  if (!loc) {
    [loc] = await db.insert(locations).values({ name }).returning();
  }
  return loc.id;
}

// List books with pagination and filters
app.get("/", async (c) => {
  const page = Number(c.req.query("page") || "1");
  const limit = Math.min(Number(c.req.query("limit") || "25"), 100);
  const format = c.req.query("format");
  const status = c.req.query("status");
  const category = c.req.query("category");
  const location = c.req.query("location");
  const sort = c.req.query("sort") || "created_at";
  const order = c.req.query("order") || "desc";

  const offset = (page - 1) * limit;

  const conditions = [];
  if (format) conditions.push(eq(books.format, format as "book" | "ebook" | "audiobook"));
  if (category) conditions.push(eq(books.category, category as "fiction" | "non-fiction"));
  if (status) conditions.push(eq(books.readStatus, status as "unread" | "reading" | "read"));
  if (location) conditions.push(eq(books.locationId, location));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = sort === "title" ? books.title : sort === "series" ? books.seriesName : books.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const [results, countResult] = await Promise.all([
    db
      .select({
        book: books,
        locationName: locations.name,
      })
      .from(books)
      .leftJoin(locations, eq(books.locationId, locations.id))
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(where),
  ]);

  // Fetch authors for all books
  const bookIds = results.map((r) => r.book.id);
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

  const booksWithAuthors = results.map(({ book, locationName }) => ({
    ...book,
    location: locationName ?? null,
    authors: authorsByBook.get(book.id) ?? [],
  }));

  const total = countResult[0]?.count ?? 0;

  return c.json({
    books: booksWithAuthors,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Get single book
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select({ book: books, locationName: locations.name })
    .from(books)
    .leftJoin(locations, eq(books.locationId, locations.id))
    .where(eq(books.id, id))
    .get();
  if (!result) return c.json({ error: "Book not found" }, 404);

  const bookAuthorRows = await db
    .select({
      authorId: authors.id,
      authorName: authors.name,
      authorPhotoUrl: authors.photoUrl,
    })
    .from(bookAuthors)
    .innerJoin(authors, eq(bookAuthors.authorId, authors.id))
    .where(eq(bookAuthors.bookId, id));

  return c.json({
    ...result.book,
    location: result.locationName ?? null,
    authors: bookAuthorRows.map((a) => ({ id: a.authorId, name: a.authorName, photoUrl: a.authorPhotoUrl })),
  });
});

// Create book
app.post("/", async (c) => {
  const body = await c.req.json();
  const { authors: authorList, location: locationName, ...bookData } = body;

  const locationId = await resolveLocationId(locationName);

  // Download cover if an external URL is provided
  let coverFilename: string | null = null;
  if (bookData.coverUrl && bookData.coverUrl.startsWith("http")) {
    coverFilename = await downloadCover("books", bookData.coverUrl);
  } else if (bookData.coverUrl) {
    coverFilename = bookData.coverUrl;
  }

  const [inserted] = await db
    .insert(books)
    .values({
      title: bookData.title,
      subtitle: bookData.subtitle || null,
      isbn10: bookData.isbn10 || null,
      isbn13: bookData.isbn13 || null,
      language: bookData.language || "en",
      pageCount: bookData.pageCount || null,
      durationMinutes: bookData.durationMinutes || null,
      format: bookData.format || "book",
      seriesName: bookData.seriesName || null,
      seriesPosition: bookData.seriesPosition || null,
      coverUrl: coverFilename,
      notes: bookData.notes || null,
      category: bookData.category || null,
      readStatus: bookData.readStatus || "unread",
      openlibraryKey: bookData.openlibraryKey || null,
      locationId,
    })
    .returning();

  // Handle authors
  if (authorList && Array.isArray(authorList)) {
    for (const authorEntry of authorList) {
      const name = typeof authorEntry === "string" ? authorEntry : authorEntry.name;
      if (!name) continue;

      // Find or create author
      let author = await db.select().from(authors).where(eq(authors.name, name)).get();
      if (!author) {
        const openlibraryKey = typeof authorEntry === "object" ? authorEntry.openlibraryKey : undefined;
        const authorPhotoUrl = typeof authorEntry === "object" ? authorEntry.photoUrl : undefined;
        let photoFilename: string | null = null;
        if (authorPhotoUrl) {
          photoFilename = await downloadCover("authors", authorPhotoUrl);
        }
        [author] = await db.insert(authors).values({ name, openlibraryKey, photoUrl: photoFilename }).returning();
      }

      await db.insert(bookAuthors).values({
        bookId: inserted.id,
        authorId: author.id,
      });
    }
  }

  // Update FTS index for this book (after authors are linked)
  updateFtsEntry(inserted.id);

  return c.json(inserted, 201);
});

// Update book
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { authors: authorList, location: locationName, ...bookData } = body;

  const existing = await db.select().from(books).where(eq(books.id, id)).get();
  if (!existing) return c.json({ error: "Book not found" }, 404);

  // If cover is being changed, delete the old file
  if (bookData.coverUrl !== undefined && bookData.coverUrl !== existing.coverUrl) {
    deleteCoverFile("books", existing.coverUrl);
  }

  const [updated] = await db
    .update(books)
    .set({
      title: bookData.title ?? existing.title,
      subtitle: bookData.subtitle !== undefined ? bookData.subtitle : existing.subtitle,
      isbn10: bookData.isbn10 !== undefined ? bookData.isbn10 : existing.isbn10,
      isbn13: bookData.isbn13 !== undefined ? bookData.isbn13 : existing.isbn13,
      language: bookData.language ?? existing.language,
      pageCount: bookData.pageCount !== undefined ? bookData.pageCount : existing.pageCount,
      durationMinutes: bookData.durationMinutes !== undefined ? bookData.durationMinutes : existing.durationMinutes,
      format: bookData.format ?? existing.format,
      seriesName: bookData.seriesName !== undefined ? bookData.seriesName : existing.seriesName,
      seriesPosition: bookData.seriesPosition !== undefined ? bookData.seriesPosition : existing.seriesPosition,
      coverUrl: bookData.coverUrl !== undefined ? bookData.coverUrl : existing.coverUrl,
      notes: bookData.notes !== undefined ? bookData.notes : existing.notes,
      category: bookData.category !== undefined ? bookData.category : existing.category,
      readStatus: bookData.readStatus ?? existing.readStatus,
      openlibraryKey: bookData.openlibraryKey !== undefined ? bookData.openlibraryKey : existing.openlibraryKey,
      locationId: locationName !== undefined ? await resolveLocationId(locationName) : existing.locationId,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(books.id, id))
    .returning();

  // Update author associations if provided
  if (authorList && Array.isArray(authorList)) {
    await db.delete(bookAuthors).where(eq(bookAuthors.bookId, id));

    for (const authorEntry of authorList) {
      const name = typeof authorEntry === "string" ? authorEntry : authorEntry.name;
      if (!name) continue;

      let author = await db.select().from(authors).where(eq(authors.name, name)).get();
      if (!author) {
        const openlibraryKey = typeof authorEntry === "object" ? authorEntry.openlibraryKey : undefined;
        const authorPhotoUrl = typeof authorEntry === "object" ? authorEntry.photoUrl : undefined;
        let photoFilename: string | null = null;
        if (authorPhotoUrl) {
          photoFilename = await downloadCover("authors", authorPhotoUrl);
        }
        [author] = await db.insert(authors).values({ name, openlibraryKey, photoUrl: photoFilename }).returning();
      }

      await db.insert(bookAuthors).values({
        bookId: id,
        authorId: author.id,
      });
    }
  }

  // Update FTS index
  updateFtsEntry(id);

  return c.json(updated);
});

// Delete book
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const book = await db.select().from(books).where(eq(books.id, id)).get();
  if (!book) return c.json({ error: "Book not found" }, 404);

  deleteCoverFile("books", book.coverUrl);
  deleteFtsEntry(id);
  await db.delete(books).where(eq(books.id, id));
  return c.json({ ok: true });
});

export default app;
