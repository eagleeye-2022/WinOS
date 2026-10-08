-- iNotes card timeline: who created / updated / shared a card and when.
-- Additive only: one new table. No existing table or row is changed. Idempotent so it is safe
-- on databases that already received it.

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoardNoteActivity" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardNoteActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BoardNoteActivity_noteId_createdAt_idx" ON "BoardNoteActivity"("noteId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BoardNoteActivity_noteId_fkey') THEN
    ALTER TABLE "BoardNoteActivity" ADD CONSTRAINT "BoardNoteActivity_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "BoardNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
