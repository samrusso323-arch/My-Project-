# Coff Coff

Landing page and waitlist for **Coff Coff**, a cafe review service that helps
coffee lovers discover, rate, and share the best local coffee shops.

## Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Turso](https://turso.tech/) (hosted, SQLite-compatible) for waitlist storage in production — falls back to a local SQLite file automatically in development, so no account is needed just to run it locally

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables
are required for local development — it writes to `local.db` in the project
root (git-ignored) automatically.

## Deploying to production

### 1. Create a Turso database

The dev fallback (a SQLite file on disk) does **not** survive on serverless
hosts like Vercel — the filesystem is wiped on every deploy. Production needs
a real database:

1. Sign up at [turso.tech](https://turso.tech) (free tier is enough to start)
2. Install their CLI and create a database:
   ```bash
   turso db create coff-coff
   turso db show coff-coff --url        # -> TURSO_DATABASE_URL
   turso db tokens create coff-coff      # -> TURSO_AUTH_TOKEN
   ```

### 2. Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading this from the repo)
2. Go to [vercel.com](https://vercel.com), "Add New Project", import the repo — it auto-detects Next.js, no config needed
3. Under Project Settings → Environment Variables, add:
   - `TURSO_DATABASE_URL` — from step 1
   - `TURSO_AUTH_TOKEN` — from step 1
4. Deploy. Every push to `main` redeploys automatically from then on.

### 3. Connect your domain

In Vercel: Project Settings → Domains → add your domain, then add the DNS
records it gives you at your registrar. Propagation is usually minutes to a
few hours.

## Waitlist

There are two waitlists, both stored via `lib/db.ts` (Turso in production,
a local SQLite file in dev).

### Coffee lovers

Handled by `app/api/waitlist/route.ts`.

- `POST /api/waitlist` — body `{ "email": "you@example.com" }`, adds an email to the waitlist
- `GET /api/waitlist` — returns `{ "count": number }`, the current waitlist size

### Cafe owners

Handled by `app/api/cafe-waitlist/route.ts`.

- `POST /api/cafe-waitlist` — body `{ "cafeName": "Your Cafe", "email": "you@yourcafe.com" }`, adds a cafe to the waitlist
- `GET /api/cafe-waitlist` — returns `{ "count": number }`, the current cafe waitlist size

To export signups in production, use the Turso CLI:

```bash
turso db shell coff-coff "SELECT email, created_at FROM waitlist;"
turso db shell coff-coff "SELECT cafe_name, email, created_at FROM cafe_waitlist;"
```

Locally, use any SQLite client against `local.db`:

```bash
sqlite3 local.db "SELECT email, created_at FROM waitlist;"
```

## Build

```bash
npm run build
npm start
```
