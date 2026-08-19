import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const p = new PrismaClient({ adapter });
(async () => {
  const email = "manager@eagleeyedigital.io";
  const code = "123456";
  await p.otpToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });
  await p.otpToken.create({
    data: { email, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  console.log("OTP created for", email, code);
  await p.$disconnect();
})();
