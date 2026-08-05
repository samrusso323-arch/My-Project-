import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'waitlist.db');

function getDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

export function addToWaitlist(email: string): { created: boolean } {
  const db = getDb();
  try {
    db.prepare('INSERT INTO waitlist (email) VALUES (?)').run(email);
    return { created: true };
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { created: false };
    }
    throw err;
  } finally {
    db.close();
  }
}

export function getWaitlistCount(): number {
  const db = getDb();
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM waitlist').get() as {
      count: number;
    };
    return row.count;
  } finally {
    db.close();
  }
}
