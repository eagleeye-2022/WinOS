/**
 * check-timelogs.js
 *
 * Fetches and displays all time logs for a Zoho project.
 *
 * Usage:
 *   node scripts/check-timelogs.js <PROJECT_ID>
 *
 * .env required:
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_PROJECTS_REFRESH_TOKEN
 */

require("dotenv").config();
const https = require("https");

const PORTAL_ID     = "60039342589";
const PROJECT_ID    = process.argv[2];
const CLIENT_ID     = "1000.HLH2SGIJ0LMLYEY7OORTNE6UW3L1DS";
const CLIENT_SECRET = "e73cc44e42174ae800e57dbf17c3495a7ce8097cfa";
const REFRESH_TOKEN = "1000.cf9038d5cca45ce159b7f80a2a180683.dd259b226eb76a70de0f21d85b36e168";


if (!PROJECT_ID) { console.error("Usage: node scripts/check-timelogs.js <PROJECT_ID>"); process.exit(1); }

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname, method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } },
      (res) => { const c = []; res.on("data", d => c.push(d)); res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } }); }
    );
    req.on("error", reject); req.write(body); req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  // Auth
  const body = new URLSearchParams({ refresh_token: REFRESH_TOKEN, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "refresh_token" }).toString();
  const auth = await post("https://accounts.zoho.in/oauth/v2/token", body);
  if (!auth.access_token) { console.error("Auth failed:", auth); process.exit(1); }
  const token = auth.access_token;

  const BASE = `https://projectsapi.zoho.in/restapi/portal/${PORTAL_ID}/projects/${PROJECT_ID}`;
  const headers = { Authorization: `Zoho-oauthtoken ${token}` };

  console.log(`\n📋  Fetching time logs for project: ${PROJECT_ID}\n`);

  // ── Method 1: Project-level logs endpoint ──────────────────────────────────
  console.log("── Method 1: /logs/ (project level) ──");
  const logUrl = new URL(`${BASE}/logs/`);
  logUrl.searchParams.set("index", "1");
  logUrl.searchParams.set("range", "100");
  const logRes = await get(logUrl.toString(), headers);
  console.log("Raw response keys:", Object.keys(logRes));
  const logs1 = logRes.timelogs?.timelogs ?? logRes.timelogs ?? logRes.logs ?? [];
  console.log(`Count: ${Array.isArray(logs1) ? logs1.length : "non-array"}`);
  if (logs1.length > 0) {
    console.log("Sample entry:", JSON.stringify(logs1[0], null, 2));
  } else {
    console.log("Full raw response:", JSON.stringify(logRes, null, 2));
  }

  await sleep(1000);

  // ── Method 2: Timesheets endpoint ─────────────────────────────────────────
  console.log("\n── Method 2: /timesheets/ endpoint ──");
  try {
    const tsUrl = new URL(`${BASE}/timesheets/`);
    tsUrl.searchParams.set("index", "1");
    tsUrl.searchParams.set("range", "100");
    const tsRes = await get(tsUrl.toString(), headers);
    console.log("Raw response keys:", Object.keys(tsRes));
    const logs2 = tsRes.timelogs?.timelogs ?? tsRes.timelogs ?? tsRes.timesheets ?? [];
    console.log(`Count: ${Array.isArray(logs2) ? logs2.length : "non-array"}`);
    if (logs2.length > 0) console.log("Sample:", JSON.stringify(logs2[0], null, 2));
    else console.log("Full response:", JSON.stringify(tsRes, null, 2));
  } catch (e) {
    console.log("Error:", e.message);
  }

  await sleep(1000);

  // ── Method 3: All tasks and check each for logs ────────────────────────────
  console.log("\n── Method 3: task-level /tasks/{id}/logs/ (first 5 tasks) ──");
  const taskUrl = new URL(`${BASE}/tasks/`);
  taskUrl.searchParams.set("index", "1");
  taskUrl.searchParams.set("range", "5");
  const taskRes = await get(taskUrl.toString(), headers);
  const tasks = taskRes.tasks ?? [];
  console.log(`Checking ${tasks.length} tasks for time logs...`);

  for (const task of tasks) {
    await sleep(800);
    const tlogUrl = new URL(`${BASE}/tasks/${task.id}/logs/`);
    const tlogRes = await get(tlogUrl.toString(), headers);
    const taskLogs = tlogRes.timelogs?.timelogs ?? tlogRes.timelogs ?? [];
    console.log(`  Task "${task.name}" → ${Array.isArray(taskLogs) ? taskLogs.length : 0} logs  |  raw keys: ${Object.keys(tlogRes)}`);
    if (taskLogs.length > 0) console.log("    Sample:", JSON.stringify(taskLogs[0], null, 2));
  }

  console.log("\n✅  Done\n");
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });