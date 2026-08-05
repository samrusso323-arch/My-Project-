# Coff Coff

Landing page and waitlist for **Coff Coff**, a cafe review service that helps
coffee lovers discover, rate, and share the best local coffee shops.

## Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for waitlist storage — no external services or API keys required

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Waitlist

There are two waitlists, both stored in a local SQLite database at
`data/waitlist.db` (created automatically on first signup, git-ignored).

### Coffee lovers

Handled by `app/api/waitlist/route.ts`.

- `POST /api/waitlist` — body `{ "email": "you@example.com" }`, adds an email to the waitlist
- `GET /api/waitlist` — returns `{ "count": number }`, the current waitlist size

### Cafe owners

Handled by `app/api/cafe-waitlist/route.ts`.

- `POST /api/cafe-waitlist` — body `{ "cafeName": "Your Cafe", "email": "you@yourcafe.com" }`, adds a cafe to the waitlist
- `GET /api/cafe-waitlist` — returns `{ "count": number }`, the current cafe waitlist size

To export signups, open `data/waitlist.db` with any SQLite client, e.g.:

```bash
sqlite3 data/waitlist.db "SELECT email, created_at FROM waitlist;"
sqlite3 data/waitlist.db "SELECT cafe_name, email, created_at FROM cafe_waitlist;"
```

## Build

```bash
npm run build
npm start
```
