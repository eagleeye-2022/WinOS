/**
 * fetch-project-full.js
 *
 * Full Zoho Project data exporter — fetches ALL data for a project and saves
 * to a structured JSON file. Safe to re-run; overwrites the output file.
 *
 * Usage:
 *   node scripts/fetch-project-full.js <PROJECT_ID> [output-dir]
 *
 * Examples:
 *   node scripts/fetch-project-full.js 296154000003869152
 *   node scripts/fetch-project-full.js 296154000003869152 ./exports
 *
 * Output:
 *   <output-dir>/project-<PROJECT_ID>.json
 *
 * .env required:
 *   ZOHO_CLIENT_ID=...
 *   ZOHO_CLIENT_SECRET=...
 *   ZOHO_PROJECTS_REFRESH_TOKEN=...
 *
 * Structure of the output JSON:
 * {
 *   meta: { exported_at, project_id, portal_id },
 *   project: { ...zoho project fields },
 *   milestones: [...],
 *   taskLists: [...],
 *   tasks: [
 *     {
 *       ...task fields,
 *       comments: [...],
 *       timelogs: [...],
 *       subtasks: [...]        ← nested here for convenience
 *     }
 *   ],
 *   allTimelogs: [...],        ← project-level time logs (separate from task-level)
 *   documents: [...],
 *   activities: [...],
 *   members: [],
 *   issues: [...]
 * }
 */

require("dotenv").config();
const https  = require("https");
const fs     = require("fs");
const path   = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────

const PORTAL_ID     = "60039342589";
const PROJECT_ID    = process.argv[2];
const OUT_DIR       = process.argv[3] || path.join(process.cwd(), "exports");
const CLIENT_ID     = "1000.HLH2SGIJ0LMLYEY7OORTNE6UW3L1DS";
const CLIENT_SECRET = "e73cc44e42174ae800e57dbf17c3495a7ce8097cfa";
const REFRESH_TOKEN = "1000.cf9038d5cca45ce159b7f80a2a180683.dd259b226eb76a70de0f21d85b36e168";

const RATE_LIMIT_MS = 1000;   // ms between API calls (Zoho allows ~100 req/min)
const PAGE_SIZE     = 100;    // tasks per page (Zoho max is 100)

if (!PROJECT_ID) {
  console.error("❌  Usage: node scripts/fetch-project-full.js <PROJECT_ID> [output-dir]");
  process.exit(1);
}
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("❌  Missing env vars: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_PROJECTS_REFRESH_TOKEN");
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
        catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

let token = "";

async function refreshToken() {
  const body = new URLSearchParams({
    refresh_token: REFRESH_TOKEN,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type:    "refresh_token",
  }).toString();
  const res = await post("https://accounts.zoho.in/oauth/v2/token", body);
  if (!res.access_token) throw new Error("Token refresh failed: " + JSON.stringify(res));
  token = res.access_token;
}

// ─── Zoho API wrapper ─────────────────────────────────────────────────────────

async function zoho(path, params = {}) {
  const url = new URL(`https://projectsapi.zoho.in/restapi${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await get(url.toString(), { Authorization: `Zoho-oauthtoken ${token}` });
  // Zoho doesn't always use HTTP status codes for errors; check body
  if (res.error_code || res.errorCode) {
    throw new Error(`Zoho API error on ${path}: ${JSON.stringify(res)}`);
  }
  return res;
}

async function zohoSafe(path, params = {}) {
  try { return await zoho(path, params); }
  catch (e) { return null; }
}

// ─── Pagination helper ────────────────────────────────────────────────────────

/**
 * Fetch all pages of a paginated endpoint.
 * @param {string} path     - API path
 * @param {string} key      - response key that holds the array (e.g. "tasks")
 * @param {object} params   - base query params
 */
async function fetchAll(path, key, params = {}) {
  const results = [];
  let index = 1;

  while (true) {
    await sleep(RATE_LIMIT_MS);
    const res = await zohoSafe(path, { ...params, index: String(index), range: String(PAGE_SIZE) });
    const page = res?.[key] ?? [];
    results.push(...page);

    const log = `    page ${Math.ceil(index / PAGE_SIZE) + 1}: ${page.length} ${key}`;
    process.stdout.write(`\r${log.padEnd(60)}`);

    if (page.length < PAGE_SIZE) break;   // last page
    index += PAGE_SIZE;
  }
  process.stdout.write("\n");
  return results;
}

// ─── Progress logger ──────────────────────────────────────────────────────────

function section(label) {
  console.log(`\n  ▸ ${label}`);
}

function done(label, count) {
  console.log(`    ✅  ${label}: ${count} records`);
}

function skipped(label, reason) {
  console.log(`    ⚠️   ${label}: ${reason}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Zoho Full Project Exporter");
  console.log("══════════════════════════════════════════════════════════════\n");

  // Auth
  process.stdout.write("  🔑  Refreshing token... ");
  await refreshToken();
  console.log("done");

  const BASE = `/portal/${PORTAL_ID}/projects/${PROJECT_ID}`;
  const result = {
    meta: {
      exported_at: new Date().toISOString(),
      project_id:  PROJECT_ID,
      portal_id:   PORTAL_ID,
    },
    project:      null,
    milestones:   [],
    taskLists:    [],
    tasks:        [],
    allTimelogs:  [],
    documents:    [],
    activities:   [],
    members:      [],
    issues:       [],
  };

  // ── 1. Project details ────────────────────────────────────────────────────
  section("Project details");
  await sleep(RATE_LIMIT_MS);
  const projRes = await zoho(`${BASE}/`);
  const proj = projRes.projects?.[0];
  if (!proj) { console.error("  ❌  Project not found"); process.exit(1); }
  result.project = proj;
  console.log(`    📁  ${proj.name} (${proj.key ?? PROJECT_ID})  |  status: ${proj.status?.name ?? "—"}`);

  // ── 2. Milestones ─────────────────────────────────────────────────────────
  section("Milestones");
  await sleep(RATE_LIMIT_MS);
  const msRes = await zohoSafe(`${BASE}/milestones/`);
  result.milestones = msRes?.milestones ?? [];
  done("Milestones", result.milestones.length);

  // ── 3. Task lists ─────────────────────────────────────────────────────────
  section("Task lists");
  await sleep(RATE_LIMIT_MS);
  const tlRes = await zohoSafe(`${BASE}/tasklists/`);
  result.taskLists = tlRes?.tasklists ?? [];
  done("Task lists", result.taskLists.length);

  // ── 4. Members ────────────────────────────────────────────────────────────
  section("Members");
  await sleep(RATE_LIMIT_MS);
  const userRes = await zohoSafe(`${BASE}/users/`);
  result.members = userRes?.users ?? [];
  done("Members", result.members.length);

  // ── 5. Issues / Bugs ──────────────────────────────────────────────────────
  section("Issues / Bugs");
  const issues = await fetchAll(`${BASE}/bugs/`, "bugs");
  result.issues = issues;
  if (issues.length === 0) skipped("Issues", "none found or module disabled");
  else done("Issues", issues.length);

  // ── 6. Activities (project timeline) ─────────────────────────────────────
  section("Activities");
  const acts = await fetchAll(`${BASE}/activities/`, "activities");
  result.activities = acts;
  if (acts.length === 0) skipped("Activities", "none returned");
  else done("Activities", acts.length);

  // ── 7. Project-level time logs ────────────────────────────────────────────
  section("Project-level time logs");
  const logs = await fetchAll(`${BASE}/logs/`, "timelogs");
  result.allTimelogs = logs;
  if (logs.length === 0) skipped("Time logs", "none returned");
  else done("Time logs", logs.length);

  // ── 8. Documents ──────────────────────────────────────────────────────────
  section("Documents");
  await sleep(RATE_LIMIT_MS);
  const docRes = await zohoSafe(`${BASE}/documents/`);
  result.documents = docRes?.documents ?? docRes?.files ?? [];
  if (result.documents.length === 0) skipped("Documents", "none returned or endpoint unavailable");
  else done("Documents", result.documents.length);

  // ── 9. All tasks (paginated) ──────────────────────────────────────────────
  section("Tasks (all pages)");
  const allTasks = await fetchAll(`${BASE}/tasks/`, "tasks");
  done("Tasks fetched", allTasks.length);

  // Separate parent tasks and subtasks
  const parentTasks  = allTasks.filter((t) => !t.parental_info?.parent_task_id);
  const rawSubtasks  = allTasks.filter((t) =>  t.parental_info?.parent_task_id);
  console.log(`    ↳  ${parentTasks.length} parent tasks, ${rawSubtasks.length} subtasks`);

  // Build subtask lookup by parent
  const subtaskMap = {};
  for (const st of rawSubtasks) {
    const pid = st.parental_info.parent_task_id;
    if (!subtaskMap[pid]) subtaskMap[pid] = [];
    subtaskMap[pid].push(st);
  }

  // ── 10. Per-task comments + task-level timelogs ──────────────────────────
  section(`Task details: comments & time logs for ${parentTasks.length} tasks`);
  let tasksDone = 0;

  for (const task of parentTasks) {
    task.comments   = [];
    task.timelogs   = [];
    task.subtasks   = subtaskMap[task.id] ?? [];

    // Comments
    await sleep(RATE_LIMIT_MS);
    const cmtRes = await zohoSafe(`${BASE}/tasks/${task.id}/comments/`);
    if (cmtRes?.comments?.length) task.comments = cmtRes.comments;

    // Task-level time logs
    await sleep(RATE_LIMIT_MS);
    const tlRes = await zohoSafe(`${BASE}/tasks/${task.id}/logs/`);
    if (tlRes?.timelogs?.timelogs?.length) task.timelogs = tlRes.timelogs.timelogs;
    else if (tlRes?.timelogs?.length)      task.timelogs = tlRes.timelogs;

    // Subtask comments
    for (const st of task.subtasks) {
      st.comments = [];
      st.timelogs = [];
      await sleep(RATE_LIMIT_MS);
      const stCmt = await zohoSafe(`${BASE}/tasks/${st.id}/comments/`);
      if (stCmt?.comments?.length) st.comments = stCmt.comments;

      await sleep(RATE_LIMIT_MS);
      const stLog = await zohoSafe(`${BASE}/tasks/${st.id}/logs/`);
      if (stLog?.timelogs?.timelogs?.length) st.timelogs = stLog.timelogs.timelogs;
      else if (stLog?.timelogs?.length)      st.timelogs = stLog.timelogs;
    }

    tasksDone++;
    const pct = Math.round((tasksDone / parentTasks.length) * 100);
    process.stdout.write(
      `\r    [${pct.toString().padStart(3)}%]  ${tasksDone}/${parentTasks.length} tasks  —  "${task.name.slice(0, 40)}"`
        .padEnd(80)
    );
  }
  process.stdout.write("\n");

  result.tasks = parentTasks;

  // Summary stats
  const totalComments  = parentTasks.reduce((s, t) =>
    s + t.comments.length + t.subtasks.reduce((ss, st) => ss + st.comments.length, 0), 0);
  const totalTaskLogs  = parentTasks.reduce((s, t) =>
    s + t.timelogs.length + t.subtasks.reduce((ss, st) => ss + st.timelogs.length, 0), 0);
  const totalSubtasks  = parentTasks.reduce((s, t) => s + t.subtasks.length, 0);

  console.log(`    ✅  ${totalSubtasks} subtasks nested, ${totalComments} comments, ${totalTaskLogs} task-level time log entries`);

  // ── 11. Save to file ──────────────────────────────────────────────────────
  section("Saving output");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `project-${PROJECT_ID}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
  const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(`    💾  Saved: ${outFile}  (${sizeMb} MB)`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Export complete");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Project  : ${proj.name}`);
  console.log(`  Tasks    : ${parentTasks.length} (+ ${rawSubtasks.length} subtasks)`);
  console.log(`  Comments : ${totalComments}`);
  console.log(`  Timelogs : ${result.allTimelogs.length} project-level + ${totalTaskLogs} task-level`);
  console.log(`  Members  : ${result.members.length}`);
  console.log(`  Issues   : ${result.issues.length}`);
  console.log(`  Output   : ${outFile}`);
  console.log("══════════════════════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("\n❌  Fatal error:", e.message);
  process.exit(1);
});
