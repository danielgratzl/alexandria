import type Database from "better-sqlite3";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

interface MigrationRecord {
  version: number;
  name: string;
}

function getMigrationFiles(): { version: number; name: string; path: string }[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.ts$/.test(f))
    .sort();

  return files.map((f) => {
    const version = parseInt(f.slice(0, 3), 10);
    return { version, name: f.replace(/\.ts$/, ""), path: join(MIGRATIONS_DIR, f) };
  });
}

export async function runMigrations(db: Database.Database) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Check if this is an existing database (pre-migration system)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const tableNames = new Set(tables.map((t) => t.name));
  const hasMigrations = db.prepare("SELECT count(*) as c FROM _migrations").get() as { c: number };

  if (hasMigrations.c === 0 && tableNames.has("books")) {
    // Existing database created before migration system — seed version 1
    console.log("[migrate] Detected existing database, seeding migration 001 as applied");
    db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(1, "001_initial");
  }

  // Get current version
  const current = db.prepare("SELECT max(version) as v FROM _migrations").get() as { v: number | null };
  const currentVersion = current.v ?? 0;

  // Load and run pending migrations
  const migrations = getMigrationFiles();
  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    console.log(`[migrate] Database is up to date (version ${currentVersion})`);
    return;
  }

  for (const migration of pending) {
    console.log(`[migrate] Applying migration ${migration.name}...`);

    const mod = await import(migration.path);
    const migrate = mod.default;

    const runInTransaction = db.transaction(() => {
      migrate(db);
      db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(migration.version, migration.name);
    });

    runInTransaction();
    console.log(`[migrate] Applied migration ${migration.name}`);
  }

  console.log(`[migrate] All migrations applied (version ${pending[pending.length - 1].version})`);
}
