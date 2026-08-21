# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

WinOS is Eagle Eye Digital's internal team-operations platform: daily standups (DSM), end-of-day
status reviews (DSR), blockers/support tracking, notes, calendar (with Zoho sync), HR-style user
management with a granular permission matrix, and an in-progress Projects module. Passwordless OTP
auth restricted to `@eagleeyedigital.io` emails; two coarse roles, `TEAM_MEMBER` and `MANAGER`.

## Commands

```bash
# Local dev setup (first time)
npm install
cp .env.example .env
npm run db:restart          # start local Prisma Dev Postgres (Docker)
npx prisma db push && npx prisma generate
npm run db:seed

npm run dev                 # start dev server (auto-starts local DB if not running)
npm run build                # production build
npm run lint                 # ESLint
npm run test                 # vitest run (all unit tests)
npm run test:watch           # vitest watch mode
npx vitest run <path>        # run a single test file
npx vitest run -t "<name>"   # run tests matching a name

npm run db:restart           # restart local Postgres (fixes stale-connection issues, see docs/local-db-debugging.md)
npm run db:inspect           # print DB row counts / debug summary
npm run db:schema            # db push + prisma generate + clear .next cache
```

When `SMTP_HOST` is unset, OTP codes print to the server console instead of being emailed — no SMTP
setup needed to log in locally.

CI (`.github/workflows/ci.yml`) runs `prisma generate → lint → test → build` on push/PR to `main`.
There is no Playwright/e2e config wired into CI — scripts in `scripts/` (`admin-flow-test.mjs`,
`e2e-verify.mjs`, `npm run smoke`) are manual/agent-driven verification aids only.

## Architecture

Next.js 16 App Router, server-first, **no standalone backend**: Prisma is called directly from
Server Components, Server Actions, and Route Handlers. There is **no `middleware.ts`** — route
protection happens per-layout: `src/app/(dashboard)/layout.tsx` calls `auth()` and redirects to
`/login` if there's no session; this is the single gate for every authenticated route, backed up
client-side by `<SessionGuard />`.

**Feature-first structure**: `src/features/<domain>/` bundles `actions/` (Server Actions),
`queries.ts` (read-side data shaping), `components/`, and `utils.ts` for one business domain
(dsm, dsr, blockers, support-needed, notes, calendar, users, projects, etc.). Routes under
`src/app/(dashboard)/<route>/page.tsx` are thin entries that import from the matching feature
folder — e.g. `src/features/dsm/` ↔ `src/app/(dashboard)/dsm/`.

**Server Action convention** (see `src/features/dsm/actions/save-dsm.ts` as the canonical example):
1. `auth()` check → bail with `{ message: "Unauthorized" }` if no session.
2. Re-query the `User` row by session id/email before writing. This guards against a stale JWT
   pointing at a deleted user (common after a local DB reset) — without it, writes fail with a raw
   FK-constraint error instead of a friendly message.
3. Parse `FormData` via `src/lib/action-utils.ts` (`getStr`, `validateText`).
4. Run Prisma writes — child collections (tasks, blockers, support-needs) are synced via
   delete-then-recreate (`deleteMany` + `createMany`/loop), not diffed, and **not wrapped in
   `db.$transaction`**. A failure mid-sequence can leave a partially-synced entry.
5. `revalidatePath(...)`, then either `redirect()` (on submit) or return a `{ message?, errors? }`
   state object for `useActionState`.

Route Handlers (`src/app/api/**/route.ts`) exist only where a real JSON endpoint is needed (Zoho
Calendar sync, uploads, notes feeds, NextAuth catch-all) and follow `auth()` → validate → try/catch
→ `NextResponse.json`.

**Auth** (`src/lib/auth.ts`): Auth.js v5 beta, single Credentials provider taking `{ email, otp }`.
Only `@eagleeyedigital.io` emails are accepted. Users are **auto-provisioned on first successful OTP
login** (not pre-created despite what the README implies) — role comes from a hardcoded
`MANAGER_EMAILS` allow-list, everyone else gets `TEAM_MEMBER`. JWT session strategy; the `session()`
callback re-queries `isActive`/`role` from the DB on every read, so deactivating a user invalidates
their session immediately rather than waiting for JWT expiry.

**Two parallel authorization systems** coexist and their precedence is not established — extending
permission logic should account for both:
- Simple `User.role` (`TEAM_MEMBER | MANAGER`) checks scattered through ~68 files for basic
  route/UI branching.
- A fully data-driven RBAC matrix (`PermissionModule` → `PermissionAction` → `PermissionRule`, keyed
  by a separate `ProfileRole` enum) surfaced at `/settings/profile-access` and defined in
  `src/features/users/permission-config.ts` / `permission-actions.ts`.

**Data layer**: Prisma 7 with `@prisma/adapter-pg`, client generated to a custom output path
(`prisma/generated/prisma`), singleton in `src/lib/db.ts`. Much action/route code casts the client
to `any` (`const d = db as any`) to work around type friction with the custom output path — this is
an existing pattern, not something to "fix" incidentally while working on unrelated code.

**Projects module caveat**: `src/features/projects/` has real Prisma models (`Project`,
`ProjectPhase`, `ProjectTask`, etc.) but they're disconnected from `User` and carry hardcoded
demo defaults (e.g. `ownerName @default("Dhruv Patidar")`), and the feature also ships parallel
static mock-data files (`src/features/projects/data/mock-*.ts`). Check whether a given view is
reading live Prisma data or mocks before assuming either.

**Two rich-text editor stacks** are present: TipTap 3 (`@tiptap/*`, extensive custom component tree
under `src/components/tiptap-*`) is the one actually used throughout the app; `@ckeditor/ckeditor5-react`
is a dependency but has no meaningful component footprint — treat TipTap as the default for any new
rich-text work.

**Dual mention storage**: blockers and support-needs store @mentions both as a legacy
`mentionedUserId`/CSV `mentionedUserIds` string pair *and* as a proper join table
(`StandupBlockerMention`, `StandupSupportNeedMention`). Code reading mentions must check both.

## Local DB debugging

Local Postgres runs via `npx prisma dev` (Prisma Dev's bundled proxy), started by
`scripts/start-db.mjs`. If Prisma Studio or `npm run db:inspect` fails with a stale-connection error
(`P1017`, "Could not load schema metadata", "Connection terminated unexpectedly"), run
`npm run db:restart` — this is a known Prisma 7 issue with idle pooled connections, not an app bug.
Prisma Studio itself is unreliable for introspection on this project until upstream fixes land; use
`npm run db:inspect` or `GET /api/debug/db-health` (dev-only, 404s in prod) instead. Full details in
`docs/local-db-debugging.md`.
