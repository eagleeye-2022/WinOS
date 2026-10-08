-- Project iNotes: an iNotes card (BoardNote) can be shared to one or more projects.
-- Additive only: one new table. No existing table or row is changed. Idempotent so it is safe
-- on databases that already received it.

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardNoteProjectShare" (
    "noteId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardNoteProjectShare_pkey" PRIMARY KEY ("noteId","projectId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BoardNoteProjectShare_projectId_idx" ON "BoardNoteProjectShare"("projectId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BoardNoteProjectShare_noteId_fkey') THEN
    ALTER TABLE "BoardNoteProjectShare" ADD CONSTRAINT "BoardNoteProjectShare_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "BoardNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BoardNoteProjectShare_projectId_fkey') THEN
    ALTER TABLE "BoardNoteProjectShare" ADD CONSTRAINT "BoardNoteProjectShare_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
