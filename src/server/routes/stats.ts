import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

const app = new Hono();

app.get("/", async (c) => {
  const sqlite = db as unknown as { all: (q: ReturnType<typeof sql>) => unknown[] };

  // Total counts
  const [totals] = await db.all(sql`
    SELECT
      (SELECT count(*) FROM books) as totalBooks,
      (SELECT count(*) FROM authors) as totalAuthors,
      (SELECT count(*) FROM locations) as totalLocations,
      (SELECT sum(page_count) FROM books WHERE page_count IS NOT NULL) as totalPages,
      (SELECT sum(duration_minutes) FROM books WHERE duration_minutes IS NOT NULL) as totalMinutes
  `) as { totalBooks: number; totalAuthors: number; totalLocations: number; totalPages: number | null; totalMinutes: number | null }[];

  // By format
  const byFormat = await db.all(sql`
    SELECT format, count(*) as count FROM books GROUP BY format ORDER BY count DESC
  `) as { format: string; count: number }[];

  // By read status
  const byStatus = await db.all(sql`
    SELECT read_status as status, count(*) as count FROM books GROUP BY read_status ORDER BY count DESC
  `) as { status: string; count: number }[];

  // By category
  const byCategory = await db.all(sql`
    SELECT COALESCE(category, 'uncategorized') as category, count(*) as count FROM books GROUP BY category ORDER BY count DESC
  `) as { category: string; count: number }[];

  // By location
  const byLocation = await db.all(sql`
    SELECT COALESCE(l.name, 'No location') as location, count(*) as count
    FROM books b
    LEFT JOIN locations l ON l.id = b.location_id
    GROUP BY b.location_id
    ORDER BY count DESC
  `) as { location: string; count: number }[];

  // Top 10 authors
  const topAuthors = await db.all(sql`
    SELECT a.name, a.photo_url as photoUrl, count(ba.book_id) as count
    FROM authors a
    JOIN book_authors ba ON ba.author_id = a.id
    GROUP BY a.id
    ORDER BY count DESC
    LIMIT 10
  `) as { name: string; photoUrl: string | null; count: number }[];

  // By language (top 10)
  const byLanguage = await db.all(sql`
    SELECT COALESCE(language, 'unknown') as language, count(*) as count
    FROM books
    GROUP BY language
    ORDER BY count DESC
    LIMIT 10
  `) as { language: string; count: number }[];

  // Recently added (last 30 days)
  const recentCount = await db.all(sql`
    SELECT count(*) as count FROM books WHERE created_at >= datetime('now', '-30 days')
  `) as { count: number }[];

  // Series with most books
  const topSeries = await db.all(sql`
    SELECT series_name as name, count(*) as count
    FROM books
    WHERE series_name IS NOT NULL AND series_name != ''
    GROUP BY series_name
    ORDER BY count DESC
    LIMIT 10
  `) as { name: string; count: number }[];

  return c.json({
    totals: {
      books: totals.totalBooks,
      authors: totals.totalAuthors,
      locations: totals.totalLocations,
      pages: totals.totalPages ?? 0,
      minutes: totals.totalMinutes ?? 0,
    },
    recentlyAdded: recentCount[0]?.count ?? 0,
    byFormat,
    byStatus,
    byCategory,
    byLocation,
    topAuthors,
    byLanguage,
    topSeries,
  });
});

export default app;
