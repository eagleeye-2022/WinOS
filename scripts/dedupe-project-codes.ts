/**
 * One-time fix for duplicate `Project.code` values, required before the
 * schema can add a `@unique` constraint on that column. `createProjectAction`
 * previously derived `code` from `db.project.count()`, which is not
 * concurrency-safe and can produce collisions (see
 * src/features/projects/actions/project-actions.ts).
 *
 * For each duplicate code, keeps the earliest-created row untouched and
 * renames every later row to a fresh, non-colliding "EEDP-N" code. Safe to
 * re-run — a no-op once no duplicates remain.
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any) as any;

function nextCodeSuffix(existingCodes: Set<string>): string {
  let n = 1;
  for (;;) {
    const candidate = `EEDP-${n}`;
    if (!existingCodes.has(candidate)) return candidate;
    n++;
  }
}

async function main() {
  const projects = await db.project.findMany({
    select: { id: true, code: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const allCodes = new Set<string>(
    projects.map((p: { code: string | null }) => p.code).filter(Boolean)
  );

  const byCode = new Map<string, typeof projects>();
  for (const p of projects) {
    if (!p.code) continue;
    const bucket = byCode.get(p.code) || [];
    bucket.push(p);
    byCode.set(p.code, bucket);
  }

  let renamedCount = 0;
  for (const [code, rows] of byCode) {
    if (rows.length <= 1) continue;
    console.log(`Duplicate code "${code}": ${rows.length} projects`);
    // Keep the earliest (rows[0], since ordered by createdAt asc); rename the rest.
    for (const row of rows.slice(1)) {
      const newCode = nextCodeSuffix(allCodes);
      allCodes.add(newCode);
      await db.project.update({ where: { id: row.id }, data: { code: newCode } });
      console.log(`  Renamed "${row.name}" (${row.id}) -> ${newCode}`);
      renamedCount++;
    }
  }

  console.log(
    renamedCount === 0
      ? "No duplicate project codes found."
      : `Renamed ${renamedCount} project(s) to resolve duplicate codes.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
