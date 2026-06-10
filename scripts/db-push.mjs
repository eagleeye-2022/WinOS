/**
 * db-push.mjs
 *
 * Wrapper around `prisma db push` that works with the Prisma dev WASM PostgreSQL.
 *
 * WHY THIS EXISTS
 * ---------------
 * The local Prisma dev server runs PostgreSQL 17 compiled to WebAssembly (emcc).
 * Its session management leaks named prepared statements across connections
 * (observed: "prepared statement 's3' already exists").  The Prisma schema
 * engine (used by `db push`, `migrate status`, `migrate resolve`) uses these
 * named statements for schema introspection and crashes when they already exist.
 *
 * Fix: DEALLOCATE ALL on the target database immediately before invoking any
 * schema-engine command.  This clears stale prepared statements from the WASM
 * PostgreSQL connection pool so the schema engine gets a clean session.
 *
 * This issue is LOCAL ONLY.  Production PostgreSQL (Amplify) is native and does
 * not pool prepared statements across sessions; `migrate deploy` (which runs
 * pre-written SQL without schema introspection) is also unaffected.
 */
import "dotenv/config";
import { execSync } from "child_process";
import pg from "pg";

const { Client } = pg;

async function deallocateAll() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("DEALLOCATE ALL");
  await c.end();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  await deallocateAll();
  console.log("[db-push] Cleared stale prepared statements");

  const output = execSync("npx prisma db push", { encoding: "utf8", stdio: "pipe" });
  // prisma db push writes to stderr for progress, stdout for final status
  process.stdout.write(output);
}

main().catch((e) => {
  console.error("[db-push]", e.message ?? String(e));
  process.exit(1);
});
