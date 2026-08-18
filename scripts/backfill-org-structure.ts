/**
 * One-time backfill for the new `User.department` field and the reporting
 * hierarchy (`User.reportingToId`) requested for the org chart:
 *
 *   Mohit (root, department: Management)
 *     -> Dhruv (wp@)      -> Mohit Thakre (m.thakre@), Ujjawal (ujjawal.mandloi@)
 *     -> Yogesh (seo@)    -> everyone else
 *
 * Everyone except Mohit is placed in the "Operation" department.
 * Upsert-free by design: only updates existing rows, matched by email, so
 * it's safe to re-run — running it again is a no-op once the data matches.
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any) as any;

async function main() {
  const mohit = await db.user.findUnique({ where: { email: "mohit@eagleeyedigital.io" } });
  const dhruv = await db.user.findUnique({ where: { email: "wp@eagleeyedigital.io" } });
  const yogesh = await db.user.findUnique({ where: { email: "seo@eagleeyedigital.io" } });
  const mohitThakre = await db.user.findUnique({ where: { email: "m.thakre@eagleeyedigital.io" } });
  const ujjawal = await db.user.findUnique({ where: { email: "ujjawal.mandloi@eagleeyedigital.io" } });

  if (!mohit) throw new Error("mohit@eagleeyedigital.io not found — run this against a DB that already has the seeded users.");
  if (!dhruv) throw new Error("wp@eagleeyedigital.io (Dhruv) not found");
  if (!yogesh) throw new Error("seo@eagleeyedigital.io (Yogesh) not found");

  await db.user.update({
    where: { id: mohit.id },
    data: { department: "Management", reportingToId: null },
  });
  console.log(`Mohit -> department=Management, root`);

  await db.user.update({
    where: { id: dhruv.id },
    data: { department: "Operation", reportingToId: mohit.id },
  });
  console.log(`Dhruv -> department=Operation, reports to Mohit`);

  await db.user.update({
    where: { id: yogesh.id },
    data: { department: "Operation", reportingToId: mohit.id },
  });
  console.log(`Yogesh -> department=Operation, reports to Mohit`);

  if (mohitThakre) {
    await db.user.update({
      where: { id: mohitThakre.id },
      data: { department: "Operation", reportingToId: dhruv.id },
    });
    console.log(`Mohit Thakre -> department=Operation, reports to Dhruv`);
  } else {
    console.log(`(skip) m.thakre@eagleeyedigital.io not found`);
  }

  if (ujjawal) {
    await db.user.update({
      where: { id: ujjawal.id },
      data: { department: "Operation", reportingToId: dhruv.id },
    });
    console.log(`Ujjawal -> department=Operation, reports to Dhruv`);
  } else {
    console.log(`(skip) ujjawal.mandloi@eagleeyedigital.io not found`);
  }

  const named = new Set([mohit.id, dhruv.id, yogesh.id, mohitThakre?.id, ujjawal?.id].filter(Boolean));
  const everyoneElse = await db.user.findMany({ where: { id: { notIn: [...named] } } });

  for (const u of everyoneElse) {
    await db.user.update({
      where: { id: u.id },
      data: { department: "Operation", reportingToId: yogesh.id },
    });
    console.log(`${u.name || u.email} -> department=Operation, reports to Yogesh`);
  }

  console.log(`\nDone. ${everyoneElse.length} other user(s) assigned to Yogesh / Operation.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
