-- Setu CRM: new tables for leads/deals, notes, calls, meetings, proposals, time logs and files.
-- Additive only: creates new Crm* enums, tables, indexes and foreign keys. No existing table or
-- column is altered or dropped; existing data is untouched.
-- Idempotent (IF NOT EXISTS / duplicate_object guards) so it is safe to run more than once.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmDealStage" AS ENUM ('LEAD', 'MEETING', 'DISCUSSION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmNoteCategory" AS ENUM ('NOTE', 'DISCUSSION', 'NEGOTIATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmCallDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmCallOutcome" AS ENUM ('CONNECTED', 'INTERESTED', 'QUALIFIED', 'COMPLETED', 'NO_ANSWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmMeetingChannel" AS ENUM ('GOOGLE_MEET', 'ZOOM', 'TEAMS', 'ONLINE', 'IN_OFFICE', 'CLIENT_LOCATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmMeetingStatus" AS ENUM ('DRAFT', 'UPCOMING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmMeetingReminder" AS ENUM ('MIN_15', 'MIN_30', 'HOUR_1', 'DAY_1');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmRsvp" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmAttendeeSource" AS ENUM ('LEAD', 'DEAL', 'GUEST', 'TEAM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmEventTone" AS ENUM ('BLUE', 'GREEN', 'AMBER', 'RED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmProposalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmFileKind" AS ENUM ('PROPOSAL_ATTACHMENT', 'CLOSING_DOCUMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmDeal" (
    "id" TEXT NOT NULL,
    "leadCode" TEXT NOT NULL,
    "dealCode" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactRole" TEXT NOT NULL DEFAULT 'Decision Maker',
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "stage" "CrmDealStage" NOT NULL DEFAULT 'LEAD',
    "ownerId" TEXT NOT NULL,
    "value" INTEGER,
    "proposalVersion" INTEGER,
    "remark" TEXT NOT NULL DEFAULT '',
    "dueDate" DATE,
    "closedAt" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmDealWon" (
    "dealId" TEXT NOT NULL,
    "finalValue" INTEGER NOT NULL,
    "closedDate" DATE NOT NULL,
    "advanceReceived" INTEGER NOT NULL,
    "contractTerm" TEXT NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmDealWon_pkey" PRIMARY KEY ("dealId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmDealLost" (
    "dealId" TEXT NOT NULL,
    "lostValue" INTEGER NOT NULL,
    "primaryReason" TEXT NOT NULL,
    "secondaryFactor" TEXT NOT NULL DEFAULT '',
    "closedDate" DATE NOT NULL,
    "analysis" TEXT NOT NULL DEFAULT '',
    "reengageDate" DATE,
    "reengageNote" TEXT NOT NULL DEFAULT '',
    "keepNurturing" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmDealLost_pkey" PRIMARY KEY ("dealId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmNote" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "category" "CrmNoteCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmNegotiationRequest" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmNegotiationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmTimeLog" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmActiveTimer" (
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActiveTimer_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmCall" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "direction" "CrmCallDirection" NOT NULL,
    "outcome" "CrmCallOutcome" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "repId" TEXT NOT NULL,
    "repRole" TEXT,
    "contactName" TEXT NOT NULL,
    "contactRole" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmMeeting" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostRole" TEXT,
    "channel" "CrmMeetingChannel" NOT NULL,
    "link" TEXT,
    "location" TEXT,
    "agenda" TEXT NOT NULL DEFAULT '',
    "status" "CrmMeetingStatus" NOT NULL DEFAULT 'UPCOMING',
    "reminder" "CrmMeetingReminder" NOT NULL DEFAULT 'MIN_30',
    "summary" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmMeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "company" TEXT,
    "external" BOOLEAN NOT NULL,
    "source" "CrmAttendeeSource" NOT NULL,
    "rsvp" "CrmRsvp" NOT NULL DEFAULT 'PENDING',
    "attended" BOOLEAN,

    CONSTRAINT "CrmMeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmMeetingEvent" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "tone" "CrmEventTone" NOT NULL DEFAULT 'BLUE',

    CONSTRAINT "CrmMeetingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmProposal" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT,
    "status" "CrmProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "sentVia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmFile" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "proposalId" TEXT,
    "kind" "CrmFileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDeal_leadCode_key" ON "CrmDeal"("leadCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDeal_dealCode_key" ON "CrmDeal"("dealCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmDeal_stage_idx" ON "CrmDeal"("stage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmDeal_ownerId_idx" ON "CrmDeal"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmDeal_dueDate_idx" ON "CrmDeal"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmNote_dealId_category_idx" ON "CrmNote"("dealId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmNegotiationRequest_dealId_idx" ON "CrmNegotiationRequest"("dealId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmTimeLog_dealId_idx" ON "CrmTimeLog"("dealId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmTimeLog_userId_idx" ON "CrmTimeLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmCall_dealId_idx" ON "CrmCall"("dealId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmMeeting_dealId_idx" ON "CrmMeeting"("dealId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmMeeting_startAt_idx" ON "CrmMeeting"("startAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmMeeting_hostId_startAt_idx" ON "CrmMeeting"("hostId", "startAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmMeetingAttendee_meetingId_idx" ON "CrmMeetingAttendee"("meetingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmMeetingAttendee_userId_idx" ON "CrmMeetingAttendee"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmMeetingEvent_meetingId_at_idx" ON "CrmMeetingEvent"("meetingId", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmProposal_dealId_status_idx" ON "CrmProposal"("dealId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrmProposal_dealId_version_key" ON "CrmProposal"("dealId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmFile_dealId_kind_idx" ON "CrmFile"("dealId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmFile_proposalId_idx" ON "CrmFile"("proposalId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmDealWon" ADD CONSTRAINT "CrmDealWon_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmDealLost" ADD CONSTRAINT "CrmDealLost_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmNegotiationRequest" ADD CONSTRAINT "CrmNegotiationRequest_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmTimeLog" ADD CONSTRAINT "CrmTimeLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmTimeLog" ADD CONSTRAINT "CrmTimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmActiveTimer" ADD CONSTRAINT "CrmActiveTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmActiveTimer" ADD CONSTRAINT "CrmActiveTimer_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmCall" ADD CONSTRAINT "CrmCall_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmCall" ADD CONSTRAINT "CrmCall_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmMeeting" ADD CONSTRAINT "CrmMeeting_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmMeeting" ADD CONSTRAINT "CrmMeeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmMeetingAttendee" ADD CONSTRAINT "CrmMeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CrmMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmMeetingAttendee" ADD CONSTRAINT "CrmMeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmMeetingEvent" ADD CONSTRAINT "CrmMeetingEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CrmMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmProposal" ADD CONSTRAINT "CrmProposal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmProposal" ADD CONSTRAINT "CrmProposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmFile" ADD CONSTRAINT "CrmFile_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmFile" ADD CONSTRAINT "CrmFile_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CrmProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmFile" ADD CONSTRAINT "CrmFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
