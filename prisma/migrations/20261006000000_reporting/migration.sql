-- Reporting (end-of-day report replaces the DSR UI; same DsrEntry table).
-- Idempotent so it is safe on databases that already received these columns via `prisma db push`.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_REMINDER';

-- AlterTable
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT;
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "dayFeedback" TEXT;
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "suggestions" TEXT;
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "isLate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "totalLoggedMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "cliqPostedAt" TIMESTAMP(3);
ALTER TABLE "DsrEntry" ADD COLUMN IF NOT EXISTS "cliqError" TEXT;
