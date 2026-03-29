import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eq, or } from "drizzle-orm";
import { db, updateFtsEntry } from "../db/index.js";
import { books, authors, bookAuthors } from "../db/schema.js";
import { lookupIsbn } from "../services/openlibrary.js";
import { downloadCover } from "../services/covers.js";

const app = new Hono();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ImportRow {
  isbn?: string;
  title?: string;
  subtitle?: string;
  authors?: string;
}

function log(msg: string) {
  console.log(`[import] ${msg}`);
}

app.post("/", async (c) => {
  const { rows } = await c.req.json() as { rows: ImportRow[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    return c.json({ error: "No data provided" }, 400);
  }

  if (rows.length > 500) {
    return c.json({ error: "Maximum 500 rows per import" }, 400);
  }

  return streamSSE(c, async (stream) => {
    log(`Starting import of ${rows.length} rows`);

    const imported: { isbn: string; title: string; source: string }[] = [];
    const notFound: string[] = [];
    const duplicates: { isbn: string; title: string }[] = [];
    const errors: string[] = [];
    let lookupCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isbn = row.isbn?.replace(/[-\s]/g, "") || "";
      const rowLabel = isbn || row.title || `row ${i + 1}`;

      try {
        // Check for duplicates by ISBN
        if (isbn) {
          const existing = await db
            .select({ id: books.id, title: books.title })
            .from(books)
            .where(or(eq(books.isbn10, isbn), eq(books.isbn13, isbn)))
            .get();

          if (existing) {
            log(`[${i + 1}/${rows.length}] DUPLICATE: ${isbn} "${existing.title}"`);
            duplicates.push({ isbn, title: existing.title });
            await stream.writeSSE({ event: "progress", data: JSON.stringify({
              current: i + 1, total: rows.length, isbn, status: "duplicate", title: existing.title,
            }) });
            continue;
          }
        }

        // Try OpenLibrary lookup if we have an ISBN
        let title: string | null = null;
        let subtitle: string | null = null;
        let isbn10: string | null = null;
        let isbn13: string | null = null;
        let language: string | null = null;
        let pageCount: number | null = null;
        let seriesName: string | null = null;
        let coverFilename: string | null = null;
        let openlibraryKey: string | null = null;
        let authorList: { name: string; openlibraryKey?: string; photoUrl?: string }[] = [];
        let source: "openlibrary" | "csv" = "csv";

        if (isbn) {
          if (lookupCount > 0) await delay(500);
          lookupCount++;

          try {
            const result = await lookupIsbn(isbn);
            if (result) {
              title = result.title;
              subtitle = result.subtitle ?? null;
              isbn10 = result.isbn10 || null;
              isbn13 = result.isbn13 || null;
              language = result.language || "en";
              pageCount = result.pageCount || null;
              seriesName = result.seriesName || null;
              openlibraryKey = result.openlibraryKey || null;
              authorList = result.authors;
              source = "openlibrary";

              if (result.coverUrl) {
                try {
                  coverFilename = await downloadCover("books", result.coverUrl);
                } catch {
                  log(`[${i + 1}/${rows.length}] WARNING: Failed to download cover for ${isbn}`);
                }
              }

              log(`[${i + 1}/${rows.length}] FOUND: ${isbn} "${title}" via OpenLibrary`);
            } else {
              log(`[${i + 1}/${rows.length}] NOT ON OPENLIBRARY: ${isbn}`);
            }
          } catch (e) {
            log(`[${i + 1}/${rows.length}] LOOKUP ERROR: ${isbn} — ${e instanceof Error ? e.message : e}`);
          }
        }

        // Fallback to CSV data
        if (!title) {
          title = row.title?.trim() || null;
          subtitle = row.subtitle?.trim() || null;
          if (row.authors) {
            authorList = row.authors.split(",").map((a) => a.trim()).filter(Boolean).map((name) => ({ name }));
          }
          if (isbn) {
            if (isbn.length === 13) isbn13 = isbn;
            else if (isbn.length === 10) isbn10 = isbn;
          }
          if (title) {
            log(`[${i + 1}/${rows.length}] FALLBACK CSV: "${title}" (${authorList.length} authors)`);
          }
        }

        // Skip if no title
        if (!title) {
          log(`[${i + 1}/${rows.length}] SKIPPED: no title available for ${rowLabel}`);
          if (isbn) notFound.push(isbn);
          await stream.writeSSE({ event: "progress", data: JSON.stringify({
            current: i + 1, total: rows.length, isbn, status: "not_found",
          }) });
          continue;
        }

        // Create book
        const [inserted] = await db
          .insert(books)
          .values({ title, subtitle, isbn10, isbn13, language: language || "en", pageCount, format: "book", seriesName, coverUrl: coverFilename, openlibraryKey })
          .returning();

        // Handle authors
        for (const authorEntry of authorList) {
          try {
            let author = await db.select().from(authors).where(eq(authors.name, authorEntry.name)).get();
            if (!author) {
              let photoFilename: string | null = null;
              if (authorEntry.photoUrl) {
                try { photoFilename = await downloadCover("authors", authorEntry.photoUrl); } catch {
                  log(`[${i + 1}/${rows.length}] WARNING: Failed to download author photo for "${authorEntry.name}"`);
                }
              }
              [author] = await db.insert(authors).values({ name: authorEntry.name, openlibraryKey: authorEntry.openlibraryKey, photoUrl: photoFilename }).returning();
            }
            await db.insert(bookAuthors).values({ bookId: inserted.id, authorId: author.id });
          } catch (e) {
            log(`[${i + 1}/${rows.length}] WARNING: Failed to add author "${authorEntry.name}" — ${e instanceof Error ? e.message : e}`);
          }
        }

        updateFtsEntry(inserted.id);
        imported.push({ isbn: isbn || "", title, source });

        await stream.writeSSE({ event: "progress", data: JSON.stringify({
          current: i + 1, total: rows.length, isbn, status: "imported", title, source,
        }) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`[${i + 1}/${rows.length}] ERROR: ${rowLabel} — ${msg}`);
        errors.push(`${rowLabel}: ${msg}`);
        await stream.writeSSE({ event: "progress", data: JSON.stringify({
          current: i + 1, total: rows.length, isbn, status: "error", message: msg,
        }) });
      }
    }

    log(`Import complete: ${imported.length} imported, ${duplicates.length} duplicates, ${notFound.length} not found, ${errors.length} errors`);

    await stream.writeSSE({ event: "done", data: JSON.stringify({
      imported, notFound, duplicates, errors,
    }) });
  });
});

export default app;
