import Database from "better-sqlite3";
import path from "node:path";

const globalForDb = global as unknown as { db?: Database.Database };

function resolveDbPath(): string {
  const raw = process.env.DB_PATH ?? "../db/lc.sqlite";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

export function getDb(): Database.Database {
  if (!globalForDb.db) {
    const file = resolveDbPath();
    const db = new Database(file, { readonly: true, fileMustExist: true });
    db.pragma("journal_mode = WAL");
    db.pragma("cache_size = -200000"); // 200MB
    db.pragma("temp_store = MEMORY");
    db.pragma("mmap_size = 268435456"); // 256MB
    globalForDb.db = db;
  }
  return globalForDb.db;
}
