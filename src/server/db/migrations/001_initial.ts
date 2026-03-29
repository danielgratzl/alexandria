import type Database from "better-sqlite3";

export default function (db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      isbn_10 TEXT,
      isbn_13 TEXT,
      language TEXT DEFAULT 'en',
      page_count INTEGER,
      duration_minutes INTEGER,
      format TEXT NOT NULL DEFAULT 'book',
      series_name TEXT,
      series_position REAL,
      cover_url TEXT,
      notes TEXT,
      category TEXT,
      read_status TEXT NOT NULL DEFAULT 'unread',
      openlibrary_key TEXT,
      location_id TEXT REFERENCES locations(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS authors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      photo_url TEXT,
      openlibrary_key TEXT
    );

    CREATE TABLE IF NOT EXISTS book_authors (
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      PRIMARY KEY (book_id, author_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
      book_id UNINDEXED,
      title,
      authors,
      series_name,
      isbn_10,
      isbn_13
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_books_format ON books(format);
    CREATE INDEX IF NOT EXISTS idx_books_read_status ON books(read_status);
    CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(name);
  `);

  // Create default admin user if none exists
  const userCount = db.prepare("SELECT count(*) as c FROM users").get() as { c: number };
  if (userCount.c === 0) {
    db.prepare("INSERT INTO users (id, username) VALUES (?, ?)").run(crypto.randomUUID(), "admin");
  }
}
