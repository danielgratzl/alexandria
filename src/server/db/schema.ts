import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const books = sqliteTable("books", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  isbn10: text("isbn_10"),
  isbn13: text("isbn_13"),
  language: text("language").default("en"),
  pageCount: integer("page_count"),
  durationMinutes: integer("duration_minutes"),
  format: text("format", { enum: ["book", "ebook", "audiobook"] }).notNull().default("book"),
  seriesName: text("series_name"),
  seriesPosition: real("series_position"),
  coverUrl: text("cover_url"),
  notes: text("notes"),
  category: text("category", { enum: ["fiction", "non-fiction"] }),
  readStatus: text("read_status", { enum: ["unread", "reading", "read"] }).notNull().default("unread"),
  openlibraryKey: text("openlibrary_key"),
  locationId: text("location_id").references(() => locations.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
});

export const authors = sqliteTable("authors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  photoUrl: text("photo_url"),
  openlibraryKey: text("openlibrary_key"),
});

export const bookAuthors = sqliteTable(
  "book_authors",
  {
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.bookId, table.authorId] })],
);

export const booksRelations = relations(books, ({ one, many }) => ({
  bookAuthors: many(bookAuthors),
  location: one(locations, {
    fields: [books.locationId],
    references: [locations.id],
  }),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  bookAuthors: many(bookAuthors),
}));

export const bookAuthorsRelations = relations(bookAuthors, ({ one }) => ({
  book: one(books, {
    fields: [bookAuthors.bookId],
    references: [books.id],
  }),
  author: one(authors, {
    fields: [bookAuthors.authorId],
    references: [authors.id],
  }),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  books: many(books),
}));

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Location = typeof locations.$inferSelect;
