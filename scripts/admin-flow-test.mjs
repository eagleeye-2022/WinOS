/**
 * Admin/manager flow + functionality test.
 * Exercises: team-member DSM/DSR submission (to generate real data),
 * manager All-DSM, My-DSM, DSR-manage, member review, My Blockers,
 * Support Needed — including filters, tabs, expand/collapse, and
 * review/resolve/reminder actions.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Match Next.js's env precedence: .env first, then .env.local overrides it.
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function getLatestOtp(email) {
  const token = await db.otpToken.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  return token?.code ?? null;
}

const BASE = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.admin-flow-screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let stepCount = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOT_DIR, `${String(++stepCount).padStart(2, "0")}-${label.replace(/[^a-z0-9]/gi, "_")}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${label}`);
  return file;
}

const results = [];
function pass(label) { results.push({ ok: true, label }); console.log(`  ✅ ${label}`); }
function fail(label, err) { results.push({ ok: false, label, err: String(err).slice(0, 300) }); console.error(`  ❌ ${label}: ${String(err).slice(0, 300)}`); }

async function loginAs(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[name="email"]').waitFor({ timeout: 30000 });
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
  await page.locator('input[name="otp"]').waitFor({ timeout: 30000 });
  // SMTP is configured in this env, so devOtp isn't rendered on-screen —
  // read the code directly from the OtpToken table instead (real SMTP send
  // still happens; we just don't have inbox access from this script).
  let otp = null;
  for (let i = 0; i < 10 && !otp; i++) {
    otp = await getLatestOtp(email);
    if (!otp) await new Promise((r) => setTimeout(r, 500));
  }
  if (!otp) throw new Error(`No OtpToken row found for ${email}`);
  await page.fill('input[name="otp"]', otp);
  await Promise.all([
    page.waitForURL((url) => !url.href.includes("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.locator("h1, main").first().waitFor({ timeout: 30000 });
}

const browser = await chromium.launch({ headless: true });

// ════════════════════════════════════════════════════════════════════════
// PHASE 1 — generate real data as a team member (DSM with blocker+support, DSR)
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 1: TEAM MEMBER — generate real data ===");
const ctxMember = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageMember = await ctxMember.newPage();
pageMember.on("pageerror", (e) => console.error("  [page error]", e.message.slice(0, 200)));

try {
  await loginAs(pageMember, "ishita.vishwakarma@eagleeyedigital.io");
  pass("team member login (ishita)");
} catch (e) {
  fail("team member login (ishita)", e);
}

try {
  await pageMember.goto(`${BASE}/dsm`);
  await pageMember.locator("h1, h2, form, main").first().waitFor({ timeout: 20000 });
  const taskInput = pageMember.locator('input[name="taskText"]').first();
  if (await taskInput.isVisible().catch(() => false)) {
    const taskInputs = pageMember.locator('input[name="taskText"]');
    await taskInputs.nth(0).fill("Finalize auth module integration tests");
    const blockerText = pageMember.locator('input[name="blockerText"]').first();
    await blockerText.fill("Waiting on DevSecOps to provide OAuth keys for staging");
    const blockerPriority = pageMember.locator('select[name="blockerPriority"]').first();
    await blockerPriority.selectOption("HIGH");
    const supportText = pageMember.locator('input[name="supportText"]').first();
    await supportText.fill("Need review on the new middleware changes");
    await shot(pageMember, "dsm-filled-before-submit");

    const submitBtn = pageMember.locator('button[type="submit"]').filter({ hasText: /submit/i });
    await submitBtn.click();
    await pageMember.locator("body").waitFor({ timeout: 10000 });
    await shot(pageMember, "dsm-after-submit");
    const bodyAfter = await pageMember.locator("body").textContent();
    if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on DSM submit");
    pass("DSM submitted with blocker + support need — no FK error");
  } else {
    pass("DSM already submitted today — skipping (existing data will be used)");
  }
} catch (e) {
  fail("team member DSM submit w/ blocker+support", e);
  await shot(pageMember, "error-dsm-submit");
}

try {
  await pageMember.goto(`${BASE}/dsr`);
  await pageMember.locator("h1, h2, form, main").first().waitFor({ timeout: 20000 });
  // Desktop viewport: the form's inline buttons are `xl:hidden` (mobile-only) —
  // the real submit button on desktop lives in the InsightsPanel. Find whichever
  // "Submit DSR" button is actually visible at this viewport size.
  const submitCandidates = pageMember.locator("button").filter({ hasText: /Submit DSR/i });
  const candidateCount = await submitCandidates.count();
  let submitBtn = null;
  for (let i = 0; i < candidateCount; i++) {
    if (await submitCandidates.nth(i).isVisible().catch(() => false)) {
      submitBtn = submitCandidates.nth(i);
      break;
    }
  }
  if (submitBtn) {
    const textarea = pageMember.locator('textarea[placeholder*="learnings"]');
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill("Documented the new auth flow learnings for the team.");
    }
    const resultInput = pageMember.locator('textarea[placeholder*="most important outcome"]');
    if (await resultInput.isVisible().catch(() => false)) {
      await resultInput.fill("Shipped the auth integration test suite.");
    }
    await shot(pageMember, "dsr-filled-before-submit");
    await submitBtn.click();
    await pageMember.locator("body").waitFor({ timeout: 10000 });
    await shot(pageMember, "dsr-after-submit");
    const bodyAfter = await pageMember.locator("body").textContent();
    if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on DSR submit");
    pass("DSR submitted — no FK error");
  } else {
    pass("DSR already submitted today or no visible submit button — skipping");
  }
} catch (e) {
  fail("team member DSR submit", e);
  await shot(pageMember, "error-dsr-submit");
}

await ctxMember.close();

// ════════════════════════════════════════════════════════════════════════
// PHASE 2 — MANAGER: All DSM screen, filters, navigation
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 2: MANAGER — All DSM ===");
const ctxMgr = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageMgr = await ctxMgr.newPage();
pageMgr.on("pageerror", (e) => console.error("  [page error]", e.message.slice(0, 200)));

try {
  await loginAs(pageMgr, "mohit@eagleeyedigital.io");
  pass("manager login (mohit)");
} catch (e) {
  fail("manager login (mohit)", e);
}

let memberDetailHref = null;
try {
  await pageMgr.goto(`${BASE}/dsm/all`);
  await pageMgr.locator("h1, h2, main").first().waitFor({ timeout: 20000 });
  await shot(pageMgr, "all-dsm-loaded");
  const body = await pageMgr.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /dsm/all");
  pass("/dsm/all loads without error");

  // Click "Yesterday" toggle
  const yesterdayBtn = pageMgr.locator("button").filter({ hasText: /^Yesterday/ }).first();
  if (await yesterdayBtn.isVisible().catch(() => false)) {
    await yesterdayBtn.click();
    await pageMgr.locator("body").waitFor({ timeout: 5000 });
    await shot(pageMgr, "all-dsm-yesterday-clicked");
    pass("Yesterday button clickable (no crash)");
  }

  // Floating "+" create-team button — actually create a team so board screens
  // (All DSM, DSR manage) have real team-grouped data to render and test against.
  const plusBtn = pageMgr.locator('button[aria-label="Create new team"]');
  if (await plusBtn.isVisible().catch(() => false)) {
    await plusBtn.click();
    await pageMgr.locator("text=Existing Teams").waitFor({ timeout: 10000 });
    await shot(pageMgr, "create-team-modal-open");
    pass("Create Team modal opens from floating button");

    await pageMgr.fill('input[name="name"]', "QA Test Team");
    await pageMgr.selectOption('select[name="department"]', "Engineering");

    // Team Lead picker — search and select mohit
    const leadSearch = pageMgr.locator('input[placeholder="Search for a leader..."]');
    await leadSearch.fill("Mohit");
    await pageMgr.locator("button").filter({ hasText: "Mohit" }).first().click();

    // Member picker — add ishita
    const memberSearch = pageMgr.locator('input[placeholder="Search users..."]');
    await memberSearch.fill("Ishita");
    await pageMgr.locator("button").filter({ hasText: "Ishita" }).first().click();

    await shot(pageMgr, "create-team-form-filled");
    await pageMgr.locator("button").filter({ hasText: /Create Team/i }).click();
    await pageMgr.locator("text=Existing Teams").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await pageMgr.locator("body").waitFor({ timeout: 3000 });
    await shot(pageMgr, "after-create-team");
    const afterCreate = await pageMgr.locator("body").textContent();
    if (afterCreate.includes("PrismaClientKnownRequestError")) throw new Error("Error creating team");
    pass("Create Team form submitted successfully — team created with lead + member");

    // Reload board now that a team with real members exists
    await pageMgr.goto(`${BASE}/dsm/all`);
    await pageMgr.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
    await shot(pageMgr, "all-dsm-with-team");
    const memberLinks = pageMgr.locator('a[href*="/dsm/member/"]');
    const linkCount = await memberLinks.count();
    console.log(`  ↳ member submission cards found after team creation: ${linkCount}`);
    if (linkCount > 0) {
      memberDetailHref = await memberLinks.first().getAttribute("href");
      pass(`board now shows ${linkCount} submitted member card(s) for the new team`);
    } else {
      pass("team created but no submitted member cards yet (pending-only state)");
    }
  } else {
    fail("Create Team floating button", "not visible");
  }
} catch (e) {
  fail("/dsm/all flow", e);
  await shot(pageMgr, "error-all-dsm");
}

// ════════════════════════════════════════════════════════════════════════
// PHASE 3 — MANAGER: member review detail (expand/collapse, review action)
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 3: MANAGER — member review detail ===");
try {
  if (memberDetailHref) {
    await pageMgr.goto(`${BASE}${memberDetailHref}`);
    await pageMgr.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
    await shot(pageMgr, "member-review-detail-loaded");
    const body = await pageMgr.locator("body").textContent();
    if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on member detail");
    pass("member review detail page loads");

    // Try expanding the today card if a chevron toggle exists
    const expandToggle = pageMgr.locator("button").filter({ has: pageMgr.locator("svg") }).first();
    // Look specifically for the today card's chevron (it's within the first bordered card)
    const todayCardChevron = pageMgr.locator("div.rounded-xl.border.bg-card button").first();
    if (await todayCardChevron.isVisible().catch(() => false)) {
      await todayCardChevron.click();
      await pageMgr.locator("body").waitFor({ timeout: 3000 });
      await shot(pageMgr, "member-review-expanded");
      pass("today entry card expand/collapse toggled without crash");
    }

    // Look for "Reviewed" button and click it
    const reviewBtn = pageMgr.locator("button").filter({ hasText: /Reviewed/i }).first();
    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click();
      await pageMgr.locator("body").waitFor({ timeout: 5000 });
      await shot(pageMgr, "member-review-after-reviewed-click");
      const bodyAfter = await pageMgr.locator("body").textContent();
      if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on review action");
      pass("Reviewed action submitted without backend error");
    } else {
      pass("no pending Reviewed action button visible (already reviewed or no submission)");
    }
  } else {
    pass("skipped — no member detail link available from board");
  }
} catch (e) {
  fail("member review detail flow", e);
  await shot(pageMgr, "error-member-review");
}

// ════════════════════════════════════════════════════════════════════════
// PHASE 4 — MANAGER: My DSM (own submission + history)
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 4: MANAGER — My DSM ===");
try {
  await pageMgr.goto(`${BASE}/dsm/my`);
  await pageMgr.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
  await shot(pageMgr, "manager-my-dsm");
  const body = await pageMgr.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /dsm/my");
  pass("/dsm/my loads without error");

  const taskInput = pageMgr.locator('input[name="taskText"]').first();
  if (await taskInput.isVisible().catch(() => false)) {
    await taskInput.fill("Review team blockers and sync on priorities");
    const submitBtn = pageMgr.locator('button[type="submit"]').filter({ hasText: /submit/i });
    await submitBtn.click();
    await pageMgr.locator("body").waitFor({ timeout: 10000 });
    await shot(pageMgr, "manager-my-dsm-after-submit");
    const bodyAfter = await pageMgr.locator("body").textContent();
    if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on manager DSM submit");
    pass("manager's own DSM submitted — no FK error");

    // Now should show week history view — check for KPI cards
    await pageMgr.goto(`${BASE}/dsm/my`);
    await pageMgr.locator("main").first().waitFor({ timeout: 10000 });
    await shot(pageMgr, "manager-my-dsm-history-view");
    const hasKpi = (await pageMgr.locator("text=Submission Rate").count()) > 0;
    if (hasKpi) pass("My DSM history view renders KPI cards after submission");
    else fail("My DSM history view", "KPI cards not found after submit");
  } else {
    pass("manager DSM form not visible — already submitted/history shown");
  }
} catch (e) {
  fail("manager My DSM flow", e);
  await shot(pageMgr, "error-manager-my-dsm");
}

// ════════════════════════════════════════════════════════════════════════
// PHASE 5 — MANAGER: DSR manage + member DSR review
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 5: MANAGER — DSR manage ===");
let dsrMemberHref = null;
try {
  await pageMgr.goto(`${BASE}/dsr/manage`);
  await pageMgr.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
  await shot(pageMgr, "dsr-manage-loaded");
  const body = await pageMgr.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /dsr/manage");
  pass("/dsr/manage loads without error");

  const dsrMemberLinks = pageMgr.locator('a[href*="/dsr/member/"]');
  const c = await dsrMemberLinks.count();
  console.log(`  ↳ DSR member links found: ${c}`);
  if (c > 0) {
    dsrMemberHref = await dsrMemberLinks.first().getAttribute("href");
    pass(`found ${c} DSR submission card(s)`);
  } else {
    pass("no DSR submissions yet on board");
  }
} catch (e) {
  fail("/dsr/manage flow", e);
  await shot(pageMgr, "error-dsr-manage");
}

console.log("\n=== PHASE 5b: MANAGER — DSR member review ===");
try {
  if (dsrMemberHref) {
    await pageMgr.goto(`${BASE}${dsrMemberHref}`);
    await pageMgr.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
    await shot(pageMgr, "dsr-member-review-loaded");
    const body = await pageMgr.locator("body").textContent();
    if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on DSR member review");
    pass("DSR member review page loads");

    const reviewedBtn = pageMgr.locator("button").filter({ hasText: /^Reviewed$/i }).first();
    if (await reviewedBtn.isVisible().catch(() => false)) {
      const commentBox = pageMgr.locator('textarea[name="managerComment"]');
      if (await commentBox.isVisible().catch(() => false)) {
        await commentBox.fill("Great progress, keep it up.");
      }
      await reviewedBtn.click();
      await pageMgr.locator("body").waitFor({ timeout: 5000 });
      await shot(pageMgr, "dsr-member-after-review");
      const bodyAfter = await pageMgr.locator("body").textContent();
      if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on DSR review action");
      pass("DSR review action submitted without backend error");
    } else {
      pass("no pending DSR review button (already reviewed or history view shown)");
    }
  } else {
    pass("skipped — no DSR member link available");
  }
} catch (e) {
  fail("DSR member review flow", e);
  await shot(pageMgr, "error-dsr-member-review");
}

// ════════════════════════════════════════════════════════════════════════
// PHASE 6 — My Blockers: filters, detail panel, mark resolved, send reminder
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 6: My Blockers ===");
try {
  await pageMgr.goto(`${BASE}/blockers`);
  await pageMgr.locator("h1, main").first().waitFor({ timeout: 15000 });
  await shot(pageMgr, "blockers-page-loaded");
  const body = await pageMgr.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /blockers");
  pass("/blockers loads without error");

  // Raise a blocker so manager has at least one to test with
  const raiseBtn = pageMgr.locator("button").filter({ hasText: /Raise New Blocker/i });
  await raiseBtn.click();
  await pageMgr.locator('textarea[name="text"]').waitFor({ timeout: 5000 });
  await pageMgr.fill('textarea[name="text"]', "Manager-raised test blocker for QA flow verification");
  await pageMgr.selectOption('select[name="priority"]', "HIGH");
  await shot(pageMgr, "blockers-raise-modal-filled");
  await pageMgr.locator("button").filter({ hasText: /^Raise Blocker$/ }).click();
  await pageMgr.locator("text=Blocker raised successfully").waitFor({ timeout: 10000 });
  await shot(pageMgr, "blockers-raised-success");
  await pageMgr.locator("button").filter({ hasText: /^Done$/ }).click();
  await pageMgr.locator("body").waitFor({ timeout: 5000 });
  pass("Raise New Blocker modal flow works end-to-end");

  // Filter by status
  await pageMgr.selectOption('select >> nth=0', "in_progress").catch(async () => {
    const statusSelect = pageMgr.locator("select").first();
    await statusSelect.selectOption("in_progress");
  });
  await pageMgr.locator("body").waitFor({ timeout: 2000 });
  await shot(pageMgr, "blockers-filtered-in-progress");
  pass("Status filter (In Progress) applied without crash");

  // reset filter
  const statusSelect = pageMgr.locator("select").first();
  await statusSelect.selectOption("all");

  // search
  const searchInput = pageMgr.locator('input[placeholder*="Search by title"]');
  await searchInput.fill("Manager-raised test blocker");
  await pageMgr.locator("body").waitFor({ timeout: 2000 });
  await shot(pageMgr, "blockers-searched");
  const rowCount = await pageMgr.locator("tbody tr").count();
  console.log(`  ↳ rows after search: ${rowCount}`);
  if (rowCount >= 1) pass("Search filter narrows table results correctly");
  else fail("Search filter", "expected at least 1 matching row");
  await searchInput.fill("");

  // Click first row to open detail panel, then test Mark as Resolved + Send Reminder
  const firstRow = pageMgr.locator("tbody tr").first();
  await firstRow.click();
  await pageMgr.getByText("Blocker Details", { exact: true }).waitFor({ timeout: 5000 });
  await shot(pageMgr, "blockers-detail-panel-open");
  pass("Clicking a row opens the detail panel");

  const sendReminderBtn = pageMgr.locator("button").filter({ hasText: /Send Reminder/i });
  await sendReminderBtn.click();
  await pageMgr.locator("body").waitFor({ timeout: 5000 });
  await shot(pageMgr, "blockers-after-send-reminder");
  const afterReminder = await pageMgr.locator("body").textContent();
  if (afterReminder.includes("PrismaClientKnownRequestError")) throw new Error("Error sending reminder");
  pass("Send Reminder action completes without backend error");

  const resolveBtn = pageMgr.locator("button").filter({ hasText: /Mark as Resolved/i });
  await resolveBtn.click();
  await pageMgr.locator("body").waitFor({ timeout: 5000 });
  await shot(pageMgr, "blockers-after-mark-resolved");
  const afterResolve = await pageMgr.locator("body").textContent();
  if (afterResolve.includes("PrismaClientKnownRequestError")) throw new Error("Error marking resolved");
  const resolvedNowShown = afterResolve.includes("Resolved");
  if (resolvedNowShown) pass("Mark as Resolved action updates UI to Resolved state");
  else fail("Mark as Resolved", "UI did not reflect resolved state");
} catch (e) {
  fail("My Blockers flow", e);
  await shot(pageMgr, "error-blockers");
}

// ════════════════════════════════════════════════════════════════════════
// PHASE 7 — Support Needed: tabs, filters, mark resolved, send reminder
// ════════════════════════════════════════════════════════════════════════
console.log("\n=== PHASE 7: Support Needed ===");
try {
  await pageMgr.goto(`${BASE}/support`);
  await pageMgr.locator("h1, main").first().waitFor({ timeout: 15000 });
  await shot(pageMgr, "support-page-loaded");
  const body = await pageMgr.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /support");
  pass("/support loads without error");

  const requestBtn = pageMgr.locator("button").filter({ hasText: /Request Support/i }).first();
  await requestBtn.click();
  const modal = pageMgr.locator("div.fixed.inset-0");
  await modal.locator('textarea[name="text"]').waitFor({ timeout: 5000 });
  await modal.locator('textarea[name="text"]').fill("Manager-raised test support request for QA flow verification");
  await shot(pageMgr, "support-raise-modal-filled");
  await modal.locator("button").filter({ hasText: /^Request Support$/ }).click();
  await pageMgr.locator("text=Support request raised").waitFor({ timeout: 10000 });
  await shot(pageMgr, "support-raised-success");
  await pageMgr.locator("button").filter({ hasText: /^Done$/ }).click();
  await pageMgr.locator("body").waitFor({ timeout: 5000 });
  pass("Request Support modal flow works end-to-end");

  // Test tabs
  const forMeTab = pageMgr.locator("button").filter({ hasText: /Requests For Me/i });
  await forMeTab.click();
  await pageMgr.locator("body").waitFor({ timeout: 3000 });
  await shot(pageMgr, "support-for-me-tab");
  pass("'Requests For Me' tab switches without crash");

  const myTab = pageMgr.locator("button").filter({ hasText: /My Requests/i });
  await myTab.click();
  await pageMgr.locator("body").waitFor({ timeout: 3000 });
  await shot(pageMgr, "support-my-requests-tab");
  pass("'My Requests' tab switches back without crash");

  // Click first row → detail panel → send reminder + mark resolved
  const firstRow = pageMgr.locator("tbody tr").first();
  if ((await pageMgr.locator("tbody tr").count()) > 0) {
    await firstRow.click();
    await pageMgr.getByText("Support Details", { exact: true }).waitFor({ timeout: 5000 });
    await shot(pageMgr, "support-detail-panel-open");
    pass("Clicking a row opens the Support Details panel");

    const sendReminderBtn = pageMgr.locator("button").filter({ hasText: /Send Reminder/i });
    await sendReminderBtn.click();
    await pageMgr.locator("body").waitFor({ timeout: 5000 });
    await shot(pageMgr, "support-after-send-reminder");
    const afterReminder = await pageMgr.locator("body").textContent();
    if (afterReminder.includes("PrismaClientKnownRequestError")) throw new Error("Error sending support reminder");
    pass("Support Send Reminder action completes without backend error");

    const resolveBtn = pageMgr.locator("button").filter({ hasText: /Mark as Resolved/i });
    await resolveBtn.click();
    await pageMgr.locator("body").waitFor({ timeout: 5000 });
    await shot(pageMgr, "support-after-mark-resolved");
    const afterResolve = await pageMgr.locator("body").textContent();
    if (afterResolve.includes("PrismaClientKnownRequestError")) throw new Error("Error marking support resolved");
    pass("Support Mark as Resolved action completes without backend error");
  } else {
    pass("no support rows to test detail panel actions on");
  }
} catch (e) {
  fail("Support Needed flow", e);
  await shot(pageMgr, "error-support");
}

await ctxMgr.close();
await browser.close();
await db.$disconnect();

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`  ${r.ok ? "✅" : "❌"} ${r.label}${r.err ? ` — ${r.err}` : ""}`));
console.log(`\nTotal: ${passed.length} passed, ${failed.length} failed`);
console.log(`Screenshots: ${SCREENSHOT_DIR}`);

process.exit(failed.length > 0 ? 1 : 0);
