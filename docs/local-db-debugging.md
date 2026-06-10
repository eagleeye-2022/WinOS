# Local DB Debugging — WinOS

## Quick reference

| Task | Command |
|---|---|
| Inspect DB state | `npm run db:inspect` |
| Restart dev DB server | `npm run db:restart` |
| Health check (browser) | `http://localhost:3000/api/debug/db-health` |

---

## Architecture

The local database is managed by **Prisma Dev** (`npx prisma dev`), which runs a
bundled PostgreSQL proxy process. The app connects to it via `@prisma/adapter-pg`
using the raw TCP address in `.env`.

```
Next.js app
  └── src/lib/db.ts  (PrismaClient + PrismaPg adapter)
        └── postgresql://localhost:5432/template1   ← DATABASE_URL in .env
              └── Prisma Dev server (winos instance)
                    └── bundled local PostgreSQL
```

---

## Known issue — stale pooled connections

### Symptom

One or more of:
- Prisma Studio shows **"Could not load schema metadata"** / introspect operation failed
- `npm run db:inspect` throws `Connection terminated unexpectedly` or `P1017`
- The app logs a `[db] startup check FAILED` message on cold start

### Cause

The Prisma dev server's PostgreSQL proxy drops idle TCP connections after long
sessions with multiple client connect/disconnect cycles (e.g. Prisma Studio
opening and closing, multiple script runs). The `pg-pool` inside
`@prisma/adapter-pg` reuses those stale connections rather than opening fresh
ones, which causes the next query to fail.

This is a known Prisma 7 issue. Prisma Studio introspection is separately
affected because the VS Code Prisma extension uses an older introspect path
that does not read `prisma.config.ts`. **Treat Prisma Studio as unreliable
for this project** until upstream fixes land.

### Fix

```bash
npm run db:restart
# Runs: node scripts/start-db.mjs 5432 5433
# Removes any stale server record, then spawns a fresh one via Node.js
# (prisma dev --detach does not work on Windows; start-db.mjs handles
#  the daemonisation correctly using spawn({ detached: true })).
```

Then verify:

```bash
npm run db:inspect
# Should print counts + user/token/notification rows
```

The ports (`5432` main, `5433` shadow) are explicitly pinned via `--db-port` and
`--shadow-db-port` flags, so they are stable across restarts.

---

## External DB client (DBeaver / TablePlus)

Use these settings to connect directly:

```
Type:     PostgreSQL
Host:     localhost
Port:     5432
Database: template1
Username: postgres
Password: postgres
SSL:      disabled
```

If the connection test times out, run `npm run db:restart` first.

---

## Dev-only health endpoint

Available only when `NODE_ENV !== "production"`:

```
GET http://localhost:3000/api/debug/db-health
```

Response:

```json
{
  "ok": true,
  "databaseUrlHost": "localhost",
  "databaseUrlPort": "5432",
  "userCount": 17,
  "otpTokenCount": 1,
  "notificationCount": 2
}
```

Returns `404` in production — no action needed to secure it.

---

## Startup observability

`src/lib/db.ts` logs on every cold process start (dev only):

```
[db] DATABASE_URL source: process.env, value: postgresql://postgres:***@localhost:5432/...
[db] startup check: user.count = 17        ← healthy
[db] startup check FAILED: <error>         ← DB is unreachable; run npm run db:restart
```

These logs appear in the Next.js terminal, not the browser.
