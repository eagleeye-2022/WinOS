// One-time script: restores the single-assignee values that existed on Project before the
// switch to multi-assignee ProjectRoleAssignment rows. Captured via a raw SQL read on
// 2026-09-08 before `prisma db push --accept-data-loss` dropped the old columns.
//
// Run once, after the schema push + `npx prisma generate`:
//   npx tsx restore-project-assignees.ts
// Then delete this file.
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const CAPTURED_ASSIGNMENTS: { projectId: string; role: string; userId: string }[] = [
  { projectId: "cmtq2wp83003gowd4r576fz6k", role: "PROJECT_LEAD", userId: "cmr95gnf5000004ldfbdke2nd" },
  { projectId: "cmtq2wp83003gowd4r576fz6k", role: "CREATIVE_ASSIGNEE", userId: "cmqg7xx08000104lco6g3zn3l" },
  { projectId: "cmtq2wp83003gowd4r576fz6k", role: "MARKETING_SEO", userId: "cmszq1we90018jkd4o7vofku8" },
  { projectId: "cmtq2wp83003gowd4r576fz6k", role: "MARKETING_CONTENT", userId: "cmtio98a7002exo4yr32foo4q" },
  { projectId: "cmtq2wp83003gowd4r576fz6k", role: "MARKETING_PM", userId: "cmszx8v22000e4od4mofyrbk3" },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const db = new PrismaClient({ adapter });

  for (const row of CAPTURED_ASSIGNMENTS) {
    await db.projectRoleAssignment.upsert({
      where: { projectId_userId_role: row },
      update: {},
      create: row,
    });
    console.log(`restored ${row.role} on ${row.projectId} -> ${row.userId}`);
  }

  await db.$disconnect();
}

main();
