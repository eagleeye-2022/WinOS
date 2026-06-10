import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    // shadowDatabaseUrl is only used by `prisma migrate dev` (which we do not run).
    // It is NOT required for `prisma migrate deploy` (production) or `prisma db push`.
    // Set SHADOW_DATABASE_URL in .env for local dev if you ever need migrate dev.
    // Do NOT set it in the Amplify console — production deploys use migrate deploy.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
