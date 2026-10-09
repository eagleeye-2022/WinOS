-- DSM: let a standup task row be linked to a project without a specific project task.
-- Additive only: one nullable column on "StandupTask". Existing rows are untouched (all NULL).
-- Idempotent so it is safe on databases that already received the column.

-- AlterTable
ALTER TABLE "StandupTask" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StandupTask" ADD CONSTRAINT "StandupTask_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
