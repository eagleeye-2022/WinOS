# Setu BNI: proposed database changes (NOT applied)

Status: **proposal only.** Nothing here has been run against any database. Every step below
needs explicit approval first (the Neon DB is shared).

## Why

The BNI version of Setu (121 Meetings, Referrals, 12-stage Sales Pipeline, WhatsApp Bot, Contacts)
currently runs on the existing `Crm*` tables with **no schema change**. It does this by encoding
a few concepts into existing text columns (see the header comment of `src/features/setu/bni.ts`):

| Concept | Stored today as |
|---|---|
| BNI member / opportunity card | `[bni:member]` / `[bni:opp]` prefix in `CrmDeal.contactRole` |
| Where a prospect came from (bot / 121) | `[bni:bot]` / `[bni:121]` in the same prefix |
| Client Meet 1 / Client Meet 2 / Agreement | `cm1` / `cm2` / `agr` tag + `CrmDeal.stage` (`PROPOSAL` / `NEGOTIATION`) |
| On Hold | `hold` tag (the record keeps its underlying stage) |
| Referral received / given | `CrmNote` titled `bni:ref-in` (`bni:ref-in>{prospectId}` once converted) / `bni:ref-out`, JSON body |
| Member to-do | `CrmNote` titled `bni:todo` / `bni:todo-done` |
| 121 meeting | `CrmMeeting` with `type` = "121 Meeting" / "Chapter Meeting" / "Networking Event" |

This works and is fully tested, but the encodings are invisible to SQL reporting and to anyone
reading the tables directly. These changes would make them real columns and tables.

## Proposed changes (all additive)

```sql
-- 1. Record kind, origin, hold flag
CREATE TYPE "CrmRecordKind" AS ENUM ('PROSPECT', 'MEMBER', 'OPPORTUNITY');
CREATE TYPE "CrmOrigin" AS ENUM ('DIRECT', 'BOT', 'MEETING_121');
ALTER TABLE "CrmDeal"
  ADD COLUMN IF NOT EXISTS "kind"   "CrmRecordKind" NOT NULL DEFAULT 'PROSPECT',
  ADD COLUMN IF NOT EXISTS "origin" "CrmOrigin"     NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS "onHold" BOOLEAN         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subStage" TEXT;          -- 'CLIENT_MEET_1' | 'CLIENT_MEET_2' | 'AGREEMENT'
CREATE INDEX IF NOT EXISTS "CrmDeal_kind_idx" ON "CrmDeal"("kind");

-- 2. Referrals as their own table
CREATE TYPE "CrmReferralDirection" AS ENUM ('RECEIVED', 'GIVEN');
CREATE TABLE IF NOT EXISTS "CrmReferral" (
  "id"          TEXT PRIMARY KEY,
  "memberId"    TEXT NOT NULL REFERENCES "CrmDeal"("id") ON DELETE CASCADE,
  "direction"   "CrmReferralDirection" NOT NULL,
  "name"        TEXT NOT NULL,
  "business"    TEXT NOT NULL DEFAULT '',
  "phone"       TEXT NOT NULL DEFAULT '',
  "via"         TEXT NOT NULL DEFAULT '',
  "prospectId"  TEXT REFERENCES "CrmDeal"("id") ON DELETE SET NULL,
  "createdById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmReferral_memberId_idx" ON "CrmReferral"("memberId");

-- 3. Member to-dos
CREATE TABLE IF NOT EXISTS "CrmTodo" (
  "id"        TEXT PRIMARY KEY,
  "dealId"    TEXT NOT NULL REFERENCES "CrmDeal"("id") ON DELETE CASCADE,
  "text"      TEXT NOT NULL,
  "done"      BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmTodo_dealId_idx" ON "CrmTodo"("dealId");

-- 4. WhatsApp bot conversation state (only needed when the real bot is built)
CREATE TABLE IF NOT EXISTS "WhatsappSession" (
  "phone"     TEXT PRIMARY KEY,           -- sender's WhatsApp number
  "userId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "state"     JSONB NOT NULL DEFAULT '{}', -- e.g. pending card awaiting "121 or Prospect?"
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## How it would roll out (each step needs approval)

1. Add the columns and tables above (additive, no existing row changed).
2. Backfill: copy the `[bni:…]` tags into `kind` / `origin` / `onHold` / `subStage`; turn
   `bni:ref-*` / `bni:todo*` notes into `CrmReferral` / `CrmTodo` rows. This step **writes data**.
3. Switch `server/data.ts` and `actions/bni-actions.ts` to the new columns (the `bni.ts` API the UI
   uses stays the same, so the screens don't change).
4. Only then remove the tag prefixes and the old notes (a second data write).

Until this is approved, the current encoding stays in place and keeps working.

## The real WhatsApp bot (separate from the DB)

The WhatsApp Bot tab works in-app today (bot console + visiting-card capture). Connecting a real
WhatsApp number also needs:

- A Meta WhatsApp Cloud API app: phone number ID, access token and webhook verify token (env vars).
- An OCR / vision key (e.g. GPT-4o) for card and handwritten-notes photos.
- `POST/GET /api/setu/whatsapp/webhook` (signature check → parse → reuse `parseBotCommand` and the
  BNI actions) plus table 4 above for multi-step conversations.
