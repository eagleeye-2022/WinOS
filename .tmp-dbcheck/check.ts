import fs from "fs";
import { PrismaClient } from "../generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const envText = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const userId = "cms8r8vtb0002jwd45ang07kf";
const entries = await prisma.standupEntry.findMany({
  where: { userId },
  orderBy: { date: "desc" },
  take: 3,
  include: { supportNeeds: true },
});
for (const e of entries) {
  console.log("entry", e.id, e.date, e.status);
  for (const s of e.supportNeeds) {
    console.log("  support", s.id, JSON.stringify(s.text), "eventId=", s.eventId);
  }
}
await prisma.$disconnect();
