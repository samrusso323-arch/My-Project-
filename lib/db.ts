import { createClient } from '@libsql/client';

// In production, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (see README).
// Locally, falls back to a SQLite file on disk so no account is needed for dev.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let ready: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS waitlist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS cafe_waitlist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cafe_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    })();
  }
  return ready;
}

function isUniqueConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('UNIQUE constraint failed');
}

export async function addToWaitlist(email: string): Promise<{ created: boolean }> {
  await ensureSchema();
  try {
    await client.execute({
      sql: 'INSERT INTO waitlist (email) VALUES (?)',
      args: [email],
    });
    return { created: true };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { created: false };
    }
    throw err;
  }
}

export async function getWaitlistCount(): Promise<number> {
  await ensureSchema();
  const result = await client.execute('SELECT COUNT(*) as count FROM waitlist');
  return Number(result.rows[0].count);
}

export async function addCafeToWaitlist(
  cafeName: string,
  email: string
): Promise<{ created: boolean }> {
  await ensureSchema();
  try {
    await client.execute({
      sql: 'INSERT INTO cafe_waitlist (cafe_name, email) VALUES (?, ?)',
      args: [cafeName, email],
    });
    return { created: true };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { created: false };
    }
    throw err;
  }
}

export async function getCafeWaitlistCount(): Promise<number> {
  await ensureSchema();
  const result = await client.execute('SELECT COUNT(*) as count FROM cafe_waitlist');
  return Number(result.rows[0].count);
}
