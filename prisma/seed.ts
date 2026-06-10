/**
 * Production seed — bootstraps real user accounts, teams, and manager workspace
 * note shells. All operations are upserts / conditional creates so this is safe
 * to re-run at any time without overwriting live user data.
 *
 * What this does NOT seed: standup entries, DSR entries, personal notes,
 * notifications, or any other runtime data. Users create that themselves.
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new PrismaClient({ adapter } as any) as any;

  // ── Users ─────────────────────────────────────────────────────────────────
  // Upsert only — never deletes. Role is set here for the initial account;
  // auth.ts also assigns role from MANAGER_EMAILS on first OTP login.

  const mohit = await db.user.upsert({
    where: { email: "mohit@eagleeyedigital.io" },
    update: { role: "MANAGER", name: "Mohit", title: "Engineering Manager" },
    create: { email: "mohit@eagleeyedigital.io", name: "Mohit", role: "MANAGER", title: "Engineering Manager" },
  });

  const seo = await db.user.upsert({
    where: { email: "seo@eagleeyedigital.io" },
    update: { role: "MANAGER", name: "SEO Manager", title: "SEO Manager" },
    create: { email: "seo@eagleeyedigital.io", name: "SEO Manager", role: "MANAGER", title: "SEO Manager" },
  });

  const ishita = await db.user.upsert({
    where: { email: "ishita.vishwakarma@eagleeyedigital.io" },
    update: { name: "Ishita Vishwakarma", title: "Senior Developer" },
    create: { email: "ishita.vishwakarma@eagleeyedigital.io", name: "Ishita Vishwakarma", role: "TEAM_MEMBER", title: "Senior Developer" },
  });

  const sarah = await db.user.upsert({
    where: { email: "sarah.jenkins@eagleeyedigital.io" },
    update: { name: "Sarah Jenkins", title: "Engineering Manager" },
    create: { email: "sarah.jenkins@eagleeyedigital.io", name: "Sarah Jenkins", role: "MANAGER", title: "Engineering Manager" },
  });

  const alex = await db.user.upsert({
    where: { email: "alex.rivera@eagleeyedigital.io" },
    update: { name: "Alex Rivera", title: "Senior Developer" },
    create: { email: "alex.rivera@eagleeyedigital.io", name: "Alex Rivera", role: "TEAM_MEMBER", title: "Senior Developer" },
  });

  const marcus = await db.user.upsert({
    where: { email: "marcus.wright@eagleeyedigital.io" },
    update: { name: "Marcus Wright", title: "Product Designer" },
    create: { email: "marcus.wright@eagleeyedigital.io", name: "Marcus Wright", role: "TEAM_MEMBER", title: "Product Designer" },
  });

  const rohan = await db.user.upsert({
    where: { email: "rohan.mehta@eagleeyedigital.io" },
    update: { name: "Rohan Mehta", title: "UI/UX Designer" },
    create: { email: "rohan.mehta@eagleeyedigital.io", name: "Rohan Mehta", role: "TEAM_MEMBER", title: "UI/UX Designer" },
  });

  const elena = await db.user.upsert({
    where: { email: "elena.rossi@eagleeyedigital.io" },
    update: { name: "Elena Rossi", title: "Marketing Specialist" },
    create: { email: "elena.rossi@eagleeyedigital.io", name: "Elena Rossi", role: "TEAM_MEMBER", title: "Marketing Specialist" },
  });

  const priya = await db.user.upsert({
    where: { email: "priya.sharma@eagleeyedigital.io" },
    update: { name: "Priya Sharma", title: "Frontend Developer" },
    create: { email: "priya.sharma@eagleeyedigital.io", name: "Priya Sharma", role: "TEAM_MEMBER", title: "Frontend Developer" },
  });

  console.log("Users ready.");

  // ── Teams ─────────────────────────────────────────────────────────────────
  // Create teams only if they don't already exist (checked by name).

  const existingTeams = await db.team.findMany({ select: { name: true } });
  const existingTeamNames = new Set(existingTeams.map((t: { name: string }) => t.name));

  if (!existingTeamNames.has("Creative Design & Brand")) {
    await db.team.create({
      data: {
        name: "Creative Design & Brand",
        department: "Design",
        description: "Brand identity, UI design, and creative assets.",
        requireApproval: false,
        notifyMembers: true,
        allowEdits: false,
        leadId: marcus.id,
        members: { create: [{ userId: marcus.id }, { userId: rohan.id }, { userId: priya.id }, { userId: elena.id }] },
      },
    });
  }

  if (!existingTeamNames.has("Tech Engineering")) {
    await db.team.create({
      data: {
        name: "Tech Engineering",
        department: "Engineering",
        description: "Backend, frontend, and infrastructure engineering.",
        requireApproval: true,
        notifyMembers: true,
        allowEdits: false,
        leadId: sarah.id,
        members: { create: [{ userId: ishita.id }, { userId: alex.id }, { userId: sarah.id }] },
      },
    });
  }

  if (!existingTeamNames.has("Marketing & Growth")) {
    await db.team.create({
      data: {
        name: "Marketing & Growth",
        department: "Marketing",
        description: "Growth campaigns, content strategy, and partnerships.",
        requireApproval: false,
        notifyMembers: true,
        allowEdits: true,
        leadId: mohit.id,
        members: { create: [{ userId: elena.id }, { userId: marcus.id }] },
      },
    });
  }

  if (!existingTeamNames.has("SMM")) {
    await db.team.create({
      data: {
        name: "SMM",
        department: "Marketing",
        description: "Social media management and community engagement.",
        requireApproval: false,
        notifyMembers: false,
        allowEdits: false,
        leadId: seo.id,
      },
    });
  }

  console.log("Teams ready.");

  // ── Manager workspace notes ───────────────────────────────────────────────
  // Create a blank workspace note for each manager if one doesn't exist yet.
  // Managers can edit content directly from the DSM page.

  for (const mgr of [mohit, seo, sarah]) {
    const existing = await db.dsmWorkspaceNote.findUnique({ where: { ownerId: mgr.id } });
    if (!existing) {
      await db.dsmWorkspaceNote.create({
        data: {
          title: "Team Focus",
          body: "",
          keyNote: "",
          ownerId: mgr.id,
        },
      });
    }
  }

  console.log("Workspace notes ready.");
  console.log("Seed complete.");

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
