import { db } from "../src/lib/db";

async function main() {
  const email = "mohitthakre1211@gmail.com";
  const user = await db.user.findUnique({ where: { email } });
  console.log("USER:", user);
  if (!user) return;

  const memberships = await db.projectMember.findMany({
    where: { userId: user.id },
    include: { project: { select: { id: true, name: true, isClientVisible: true } } },
  });
  console.log("MEMBERSHIPS:", JSON.stringify(memberships, null, 2));

  const invitations = await db.clientInvitation.findMany({
    where: { email },
    include: { projects: { include: { project: { select: { id: true, name: true } } } } },
  });
  console.log("INVITATIONS:", JSON.stringify(invitations, null, 2));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
