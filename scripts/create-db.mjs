/**
 * create-db.mjs
 *
 * Creates the local development databases on the running Prisma dev PostgreSQL
 * server.  Run this once after `npm run db:restart` and before `npm run db:schema`.
 *
 * Usage:
 *   node scripts/create-db.mjs
 *
 * Databases created:
 *   winos         — main application database  (DATABASE_URL)
 *   winos_shadow  — Prisma Migrate shadow database (SHADOW_DATABASE_URL)
 *
 * Both databases are created on the SAME server / port as DATABASE_URL so that
 * `prisma migrate dev` can DROP and CREATE the shadow database without opening a
 * second server connection (which causes P1017).
 */
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

/**
 * Returns a connection string that points to the 'template1' admin database
 * on the same host/port/credentials as the given URL.
 * We connect to template1 (not the app database) so that CREATE DATABASE can run.
 */
function adminUrl(connectionString) {
  // Replace the path component (database name) with /template1.
  // Handles postgresql:// and postgres:// schemes.
  return connectionString.replace(
    /(postgres(?:ql)?:\/\/[^/]+\/)([^?#]*)(.*)/,
    "$1template1$3",
  );
}

async function ensureDatabase(client, name) {
  const { rows } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name],
  );
  if (rows.length > 0) {
    console.log(`[create-db] '${name}' already exists — skipping`);
    return false;
  }
  // Identifiers cannot be parameterised; the values here are constant strings.
  await client.query(`CREATE DATABASE "${name}"`);
  console.log(`[create-db] Created database '${name}'`);
  return true;
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill in values.");
  }

  const url = adminUrl(rawUrl);
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    console.log("[create-db] Connected to PostgreSQL");

    await ensureDatabase(client, "winos");
    await ensureDatabase(client, "winos_shadow");

    console.log("[create-db] Done. Next: npm run db:schema");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[create-db] Failed:", e.message);
  process.exit(1);
});
