import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { existsSync, mkdirSync } from "fs";
import { runMigrations } from "./migrate.js";

const dataDir = "./data";
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database("./data/alexandria.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export async function initializeDatabase() {
  await runMigrations(sqlite);
}

export function updateFtsEntry(bookId: string) {
  sqlite.prepare("DELETE FROM books_fts WHERE book_id = ?").run(bookId);

  const book = sqlite.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as Record<string, unknown> | undefined;
  if (!book) return;

  const authors = sqlite.prepare(
    "SELECT group_concat(a.name, ', ') as names FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = ?"
  ).get(bookId) as { names: string | null } | undefined;

  sqlite.prepare(
    "INSERT INTO books_fts(book_id, title, authors, series_name, isbn_10, isbn_13) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(bookId, book.title, authors?.names ?? null, book.series_name, book.isbn_10, book.isbn_13);
}

export function deleteFtsEntry(bookId: string) {
  sqlite.prepare("DELETE FROM books_fts WHERE book_id = ?").run(bookId);
}
