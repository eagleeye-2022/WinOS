-- All Projects table: Industry + Client Location (Country / State / City) columns.
-- Additive only: six nullable columns on "Project". Existing rows are untouched (all NULL).
-- Idempotent so it is safe on databases that already received the columns.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientCountry" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientCountryCode" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientState" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientStateCode" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientCity" TEXT;
