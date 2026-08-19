/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const d = db as any;

  const teamMembers = await d.teamMember.findMany({
    include: {
      team: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  console.log("=== TEAM MEMBERS IN DB ===");
  for (const tm of teamMembers) {
    console.log(`User: ${tm.user.name} (${tm.user.email}) -> Team: ${tm.team.name}`);
  }

  const testUser = await d.user.findFirst({ where: { email: "test@eagleeyedigital.io" } });
  if (testUser) {
    const testTm = await d.teamMember.findFirst({ where: { userId: testUser.id } });
    console.log("\nTest user in teamMember:", testTm);
  }
}

main().catch(console.error).finally(() => process.exit());
