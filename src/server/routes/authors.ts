import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authors, bookAuthors, books } from "../db/schema.js";
import { deleteCoverFile } from "../services/covers.js";

const app = new Hono();

// List authors with book counts and pagination
app.get("/", async (c) => {
  const page = Number(c.req.query("page") || "1");
  const limit = Math.min(Number(c.req.query("limit") || "25"), 100);
  const offset = (page - 1) * limit;

  const [results, countResult] = await Promise.all([
    db
      .select({
        id: authors.id,
        name: authors.name,
        photoUrl: authors.photoUrl,
        openlibraryKey: authors.openlibraryKey,
        bookCount: sql<number>`count(${bookAuthors.bookId})`,
      })
      .from(authors)
      .leftJoin(bookAuthors, eq(authors.id, bookAuthors.authorId))
      .groupBy(authors.id)
      .orderBy(authors.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(authors),
  ]);

  const total = countResult[0]?.count ?? 0;

  return c.json({
    authors: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Get author with their books
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const author = await db.select().from(authors).where(eq(authors.id, id)).get();
  if (!author) return c.json({ error: "Author not found" }, 404);

  const authorBooks = await db
    .select({
      id: books.id,
      title: books.title,
      subtitle: books.subtitle,
      format: books.format,
      coverUrl: books.coverUrl,
      readStatus: books.readStatus,
      seriesName: books.seriesName,
      seriesPosition: books.seriesPosition,
    })
    .from(bookAuthors)
    .innerJoin(books, eq(bookAuthors.bookId, books.id))
    .where(eq(bookAuthors.authorId, id))
    .orderBy(books.title);

  return c.json({ ...author, books: authorBooks });
});

// Update author
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db.select().from(authors).where(eq(authors.id, id)).get();
  if (!existing) return c.json({ error: "Author not found" }, 404);

  // If photo is being changed, delete the old file
  if (body.photoUrl !== undefined && body.photoUrl !== existing.photoUrl) {
    deleteCoverFile("authors", existing.photoUrl);
  }

  const [updated] = await db
    .update(authors)
    .set({
      name: body.name ?? existing.name,
      photoUrl: body.photoUrl !== undefined ? body.photoUrl : existing.photoUrl,
    })
    .where(eq(authors.id, id))
    .returning();

  return c.json(updated);
});

// Delete author (removes association with books, keeps books)
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.select().from(authors).where(eq(authors.id, id)).get();
  if (!existing) return c.json({ error: "Author not found" }, 404);

  deleteCoverFile(existing.photoUrl);
  await db.delete(bookAuthors).where(eq(bookAuthors.authorId, id));
  await db.delete(authors).where(eq(authors.id, id));
  return c.json({ ok: true });
});

export default app;
