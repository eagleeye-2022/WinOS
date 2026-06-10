/**
 * start-db.mjs
 *
 * Manages the local Prisma dev database server.
 * Replaces the shell-level `prisma dev --detach` approach, which fails silently
 * on Windows because the OS does not honour the detach flag the same way Unix does.
 *
 * Usage:
 *   node scripts/start-db.mjs [--if-not-running] [db-port] [shadow-port]
 *
 *   --if-not-running   Exit immediately if the DB port is already accepting
 *                      connections.  Used by `npm run dev` so a running DB is
 *                      not killed and restarted on every dev server restart.
 *
 * Defaults: db-port=5432, shadow-port=5433
 */
import { spawn, execSync } from "child_process";
import { createConnection } from "net";

const args = process.argv.slice(2);
const ifNotRunning = args.includes("--if-not-running");
const numericArgs = args.filter((a) => !a.startsWith("--")).map(Number).filter(Boolean);
const DB_PORT = numericArgs[0] ?? 5432;
const SHADOW_PORT = numericArgs[1] ?? 5433;
const SERVER_NAME = "winos";
const TIMEOUT_MS = 25_000;
const POLL_MS = 400;

// ── Helpers ───────────────────────────────────────────────────────────────────

function probePort(port) {
  return new Promise((resolve) => {
    const s = createConnection(port, "localhost");
    s.setTimeout(500);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error",   () => { s.destroy(); resolve(false); });
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePort(port)) return true;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Fast-path: DB already up and --if-not-running was passed (used by npm run dev).
  if (ifNotRunning && (await probePort(DB_PORT))) {
    console.log(`[start-db] DB already running on port ${DB_PORT} — skipping start.`);
    return;
  }

  // Remove any stale server record so the new one starts with the right port.
  // (prisma dev ignores --db-port if a record for that name already exists.)
  try {
    execSync(`npx prisma dev rm ${SERVER_NAME}`, { stdio: "pipe" });
    console.log(`[start-db] Cleared existing '${SERVER_NAME}' server record.`);
  } catch {
    // Didn't exist — that's fine.
  }

  console.log(`[start-db] Starting '${SERVER_NAME}' on port ${DB_PORT}...`);

  // shell:true is required on Windows: .cmd files (like npx.cmd) are batch scripts
  // and cannot be spawned directly — doing so throws EINVAL.  With shell:true,
  // Node.js wraps the command in `cmd.exe /d /s /c ...`, which handles .cmd files
  // correctly.  Combined with detached:true, cmd.exe gets its own process group so
  // the whole chain (cmd.exe → npx → prisma dev) survives after this script exits.
  // shell:true is harmless on Unix (uses sh -c) so no platform branch is needed.
  const child = spawn(
    "npx",
    [
      "prisma", "dev",
      "--name",            SERVER_NAME,
      "--db-port",         String(DB_PORT),
      "--shadow-db-port",  String(SHADOW_PORT),
    ],
    {
      shell:        true,   // Needed on Windows: resolves npx.cmd via cmd.exe
      detached:     true,   // New process group — survives parent exit
      stdio:        "ignore",
      windowsHide:  true,   // No flashing cmd window on Windows
    },
  );

  child.on("error", (err) => {
    console.error(`[start-db] Failed to launch prisma dev: ${err.message}`);
    process.exit(1);
  });

  child.unref(); // This script can exit once the port is ready; child keeps running.

  const ready = await waitForPort(DB_PORT, TIMEOUT_MS);

  if (!ready) {
    console.error(`[start-db] Timed out — port ${DB_PORT} not ready after ${TIMEOUT_MS / 1000}s.`);
    console.error(`[start-db] Debug: run  npx prisma dev ls`);
    console.error(`[start-db]        run  npx prisma dev --name ${SERVER_NAME} --db-port ${DB_PORT}  (without --detach to see errors)`);
    process.exit(1);
  }

  console.log(`[start-db] port ${DB_PORT} ready ✓`);
}

main().catch((e) => {
  console.error("[start-db]", e.message);
  process.exit(1);
});
