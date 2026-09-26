/**
 * check-zoho-project.js
 *
 * Simple diagnostic script — checks what data is available for a Zoho project.
 * Does NOT import anything. Just prints counts and samples to the console.
 *
 * Usage:
 *   node check-zoho-project.js <PROJECT_ID>
 *
 * Example:
 *   node check-zoho-project.js 296154000003869152
 *
 * .env required:
 *   ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET — client that issued the refresh token
 *                                         (falls back to the app's CLIENT_ID / CLIENT_SECRET)
 *   ZOHO_PROJECTS_REFRESH_TOKEN=...     — refresh token with a ZohoProjects scope
 */

require("dotenv").config();
const https = require("https");

const PORTAL_ID     = "60039342589";
const PROJECT_ID    = process.argv[2];
// ZOHO_* wins so a Self Client (whose refresh token only works with its own id/secret) can be used
// without touching the app's CLIENT_ID/CLIENT_SECRET.
const CLIENT_ID     = "1000.HLH2SGIJ0LMLYEY7OORTNE6UW3L1DS";
const CLIENT_SECRET = "e73cc44e42174ae800e57dbf17c3495a7ce8097cfa";
const REFRESH_TOKEN = "1000.e03fa71d90de84408c27d11db520366b.e8cd1d4c01f50e019424d81aaa614d8d";
if (!PROJECT_ID) {
  console.error("❌  Usage: node check-zoho-project.js <PROJECT_ID>");
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("❌  Missing CLIENT_ID, CLIENT_SECRET or ZOHO_PROJECTS_REFRESH_TOKEN in .env");
  process.exit(1);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let token = "";

async function refreshToken() {
  const body = new URLSearchParams({
    refresh_token: REFRESH_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
  }).toString();
  const res = await post("https://accounts.zoho.in/oauth/v2/token", body);
  if (!res.access_token) throw new Error("Token refresh failed: " + JSON.stringify(res));
  token = res.access_token;
}

async function zoho(path, params = {}) {
  const url = new URL(`https://projectsapi.zoho.in/restapi${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await get(url.toString(), { Authorization: `Zoho-oauthtoken ${token}` });
  if (res.error_code || res.errorCode) throw new Error("Zoho error: " + JSON.stringify(res));
  return res;
}

// ─── Check helpers ─────────────────────────────────────────────────────────────

function ok(label, count, sample) {
  const preview = sample ? `  →  sample: "${sample}"` : "";
  console.log(`  ✅  ${label.padEnd(20)} ${String(count).padStart(4)} records${preview}`);
}

function warn(label, msg) {
  console.log(`  ⚠️   ${label.padEnd(20)} ${msg}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("  Zoho Project Data Checker");
  console.log("══════════════════════════════════════════\n");

  // 1. Auth
  process.stdout.write("🔑  Refreshing token... ");
  await refreshToken();
  console.log("done\n");

  const BASE = `/portal/${PORTAL_ID}/projects/${PROJECT_ID}`;

  // 2. Project
  const projRes = await zoho(`${BASE}/`);
  const proj = projRes.projects?.[0];
  if (!proj) { console.error("❌  Project not found"); process.exit(1); }
  console.log(`📁  Project: ${proj.name} (${proj.key ?? PROJECT_ID})`);
  console.log(`    Status: ${proj.status?.name ?? "—"}  |  Owner: ${proj.owner?.name ?? "—"}\n`);
  await sleep(800);

  // 3. Milestones
  const msRes = await zoho(`${BASE}/milestones/`);
  const milestones = msRes.milestones ?? [];
  ok("Milestones", milestones.length, milestones[0]?.name);
  await sleep(800);

  // 4. Task lists
  const tlRes = await zoho(`${BASE}/tasklists/`);
  const taskLists = tlRes.tasklists ?? [];
  ok("Task Lists", taskLists.length, taskLists[0]?.name);
  await sleep(800);

  // 5. Tasks (page 1 only — just to check)
  const taskRes = await zoho(`${BASE}/tasks/`, { index: "1", range: "50" });
  const tasks = taskRes.tasks ?? [];
  const withParent = tasks.filter((t) => t.parental_info?.parent_task_id).length;
  ok("Tasks (page 1)", tasks.length, tasks[0]?.name);
  console.log(`             ↳  ${withParent} subtasks found on this page`);
  await sleep(800);

  // 6. Task owners check
  const ownersFound = tasks.filter((t) => t.details?.owners?.length > 0).length;
  console.log(`             ↳  ${ownersFound}/${tasks.length} tasks have owners assigned`);

  // 7. Time logs
  const logRes = await zoho(`${BASE}/logs/`, { index: "1", range: "10" });
  const logs = logRes.timelogs?.timelogs ?? logRes.timelogs ?? [];
  ok("Time Logs (sample)", logs.length, logs[0]?.task_name);
  await sleep(800);

  // 8. Documents
  try {
    const docRes = await zoho(`${BASE}/documents/`);
    const docs = docRes.documents ?? docRes.files ?? [];
    ok("Documents", docs.length, docs[0]?.name ?? docs[0]?.title);
  } catch (e) {
    warn("Documents", "endpoint not available or empty");
  }
  await sleep(800);

  // 9. Activities / Timeline
  try {
    const actRes = await zoho(`${BASE}/activities/`, { index: "1", range: "10" });
    const acts = actRes.activities ?? [];
    ok("Activities (sample)", acts.length, acts[0]?.activity_type ?? acts[0]?.name);
  } catch (e) {
    warn("Activities", "endpoint not available");
  }
  await sleep(800);

  // 10. Users / Members
  try {
    const userRes = await zoho(`${BASE}/users/`);
    const users = userRes.users ?? [];
    ok("Members", users.length, users[0]?.name);
  } catch (e) {
    warn("Members", "endpoint not available");
  }
  await sleep(800);

  // 11. Issues / Bugs
  try {
    const bugRes = await zoho(`${BASE}/bugs/`, { index: "1", range: "10" });
    const bugs = bugRes.bugs ?? [];
    ok("Issues/Bugs", bugs.length, bugs[0]?.title);
  } catch (e) {
    warn("Issues/Bugs", "endpoint not available or no bugs module");
  }

  // 12. Task comments (check on first task only)
  if (tasks.length > 0) {
    await sleep(800);
    const firstTaskId = tasks[0].id;
    try {
      const cmtRes = await zoho(`${BASE}/tasks/${firstTaskId}/comments/`);
      const cmts = cmtRes.comments ?? [];
      console.log(`\n  💬  Comments check on first task ("${tasks[0].name}"):`);
      ok("Comments", cmts.length, cmts[0]?.content ?? cmts[0]?.text);
    } catch (e) {
      warn("Comments", "endpoint error on first task");
    }
  }

  console.log("\n══════════════════════════════════════════");
  console.log("  ✅  Check complete — all endpoints tested");
  console.log("══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("\n❌  Error:", e.message);
  process.exit(1);
});