/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./src/lib/db";
import { toUtcDate, toIsoDateStr } from "./src/features/dsm/utils";

async function main() {
  const d = db as any;

  const teamMembers = await d.teamMember.findMany({
    where: { user: { role: "TEAM_MEMBER" } },
    select: { userId: true },
  });
  const memberIds: string[] = Array.from(new Set(teamMembers.map((tm: any) => tm.userId)));
  console.log("memberIds:", memberIds.length);

  // Check last 7 days for SUBMITTED / PENDING_REVIEW dsr entries
  for (let i = 0; i < 7; i++) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const targetDate = toUtcDate(day);
    const entries = await d.dsrEntry.findMany({
      where: { userId: { in: memberIds }, date: targetDate },
      select: { status: true, userId: true, user: { select: { name: true } } },
    });
    const pr = entries.filter((e: any) => e.status === "SUBMITTED" || e.status === "PENDING_REVIEW");
    console.log(toIsoDateStr(targetDate), "entries:", entries.length, "pendingReview:", pr.length, pr.map((e: any) => `${e.user.name}(${e.status})`).join(", "));
  }

  console.log("\n-- Full status breakdown today --");
  const today = toUtcDate(new Date());
  const todayEntries = await d.dsrEntry.findMany({
    where: { userId: { in: memberIds }, date: today },
    select: { status: true, userId: true, user: { select: { name: true } } },
  });
  todayEntries.forEach((e: any) => console.log(" ", e.user.name, e.status));
  console.log("no-entry members:", memberIds.length - todayEntries.length);

  await d.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
