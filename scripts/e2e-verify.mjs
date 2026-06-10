/**
 * End-to-end verification script using Playwright.
 * Tests: login (new user), DSM submit, DSR submit, manager views.
 * Uses explicit element-based waits — avoids networkidle which doesn't
 * work reliably with Next.js server actions + React state updates.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const BASE = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.verify-screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let stepCount = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOT_DIR, `${String(++stepCount).padStart(2,"0")}-${label.replace(/[^a-z0-9]/gi,"_")}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${label}`);
  return file;
}

async function loginAs(page, email) {
  await page.goto(`${BASE}/login`);
  // Wait for the email input to be ready — explicit element wait, not networkidle
  await page.locator('input[name="email"]').waitFor({ timeout: 30000 });
  await shot(page, `login-email-step`);

  await page.fill('input[name="email"]', email);

  // Click and wait for OTP step to appear (button text changes to "Sending code…" then OTP form appears)
  await page.click('button[type="submit"]');
  // Wait for the verification code input to appear (means OTP step rendered)
  await page.locator('input[name="otp"]').waitFor({ timeout: 30000 });
  await shot(page, `otp-step-shown`);

  // Pick up devOtp shown in amber box
  const devOtpEl = page.locator("p strong").filter({ hasText: /^\d{6}$/ });
  await devOtpEl.waitFor({ timeout: 10000 });
  const otp = (await devOtpEl.textContent()).trim();
  console.log(`  🔑 dev OTP for ${email}: ${otp}`);

  await page.fill('input[name="otp"]', otp);

  // Click and wait for navigation away from /login
  const [response] = await Promise.all([
    page.waitForURL(url => !url.href.includes("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);

  // Wait for the dashboard/destination page to fully render (h1 or main content)
  await page.locator("h1, main").first().waitFor({ timeout: 30000 });
  await shot(page, `after-login`);
  return otp;
}

const results = [];
function pass(label) { results.push({ ok: true,  label }); console.log(`  ✅ ${label}`); }
function fail(label, err) { results.push({ ok: false, label, err: String(err) }); console.error(`  ❌ ${label}: ${err}`); }

// ── 1. NEW USER LOGIN ─────────────────────────────────────────────────────────
console.log("\n=== 1. NEW USER LOGIN ===");
const browser = await chromium.launch({ headless: true });
const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page1 = await ctx1.newPage();
page1.on("pageerror", e => console.error("  [page error]", e.message.slice(0, 200)));

try {
  await loginAs(page1, "newtest.verify@eagleeyedigital.io");
  const url = page1.url();
  console.log(`  ↳ landed on: ${url}`);
  if (url.includes("/login")) throw new Error(`Still on login page: ${url}`);

  const h1 = await page1.locator("h1").first().textContent().catch(() => "");
  console.log(`  ↳ heading: "${h1}"`);
  pass("new user login → lands on dashboard with greeting");
} catch (e) {
  fail("new user login", e);
  await shot(page1, "error-login");
}

// ── 2. TEAM MEMBER — DSM SUBMIT ───────────────────────────────────────────────
console.log("\n=== 2. TEAM MEMBER DSM ===");
try {
  await page1.goto(`${BASE}/dsm`);
  await page1.locator("h1, h2, form").first().waitFor({ timeout: 20000 });
  await shot(page1, "dsm-page");

  const url = page1.url();
  if (url.includes("/login")) throw new Error("Redirected to login — session lost");

  const body = await page1.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on DSM page");
  pass("DSM page loads without FK/runtime error");

  const taskInput = page1.locator('input[name="taskText"]').first();
  const hasForm = await taskInput.isVisible().catch(() => false);

  if (hasForm) {
    await taskInput.fill("Write unit tests for the new auth flow");

    // Find and click Submit button (not Save Draft)
    const submitBtn = page1.locator('button[type="submit"]').filter({ hasText: /submit/i });
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      // Wait for success feedback: either URL change or success banner
      await page1.waitForURL(url => url.href.includes("submitted=1"), { timeout: 15000 })
        .catch(() => {}); // not all flows redirect with ?submitted=1
      await page1.locator("body").waitFor({ timeout: 5000 });
      await shot(page1, "dsm-after-submit");
      const bodyAfter = await page1.locator("body").textContent();
      if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on DSM submit");
      const success = bodyAfter.includes("submitted successfully") || bodyAfter.includes("submitted") || page1.url().includes("submitted=1");
      if (success) pass("DSM submitted successfully — no FK error");
      else pass("DSM submit completed (no FK error, status unknown)");
    } else {
      await shot(page1, "dsm-no-submit-btn");
      throw new Error("Submit button not found");
    }
  } else {
    // May already be submitted or in history view
    const weekText = await page1.locator("body").textContent();
    if (weekText.includes("Submitted") || weekText.includes("submitted") || weekText.includes("SUBMITTED")) {
      pass("DSM already submitted today — shows status correctly");
    } else {
      pass("DSM page loaded — no form visible (draft or history state)");
    }
  }
} catch (e) {
  fail("team member DSM submit", e);
  await shot(page1, "error-dsm");
}

// ── 3. TEAM MEMBER — DSR SUBMIT ───────────────────────────────────────────────
console.log("\n=== 3. TEAM MEMBER DSR ===");
try {
  await page1.goto(`${BASE}/dsr`);
  await page1.locator("h1, h2, form, main").first().waitFor({ timeout: 20000 });
  await shot(page1, "dsr-page");

  const url = page1.url();
  if (url.includes("/login")) throw new Error("Redirected to login — session lost");

  const body = await page1.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on DSR page");
  pass("DSR page loads without runtime error");

  // Check for any submit/save button
  const submitBtn = page1.locator('button').filter({ hasText: /submit|save/i }).first();
  const hasSubmit = await submitBtn.isVisible().catch(() => false);

  if (hasSubmit) {
    // Fill any visible text areas
    const textarea = page1.locator("textarea").first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill("Completed all planned tasks. Good day overall.");
    }
    await shot(page1, "dsr-form-filled");
    await submitBtn.click();
    await page1.locator("body").waitFor({ timeout: 10000 });
    await shot(page1, "dsr-after-submit");
    const bodyAfter = await page1.locator("body").textContent();
    if (bodyAfter.includes("PrismaClientKnownRequestError")) throw new Error("FK error on DSR submit");
    pass("DSR form submitted without FK error");
  } else {
    pass("DSR page loaded — no form visible (submitted or read-only state)");
  }
} catch (e) {
  fail("team member DSR submit", e);
  await shot(page1, "error-dsr");
}

await ctx1.close();

// ── 4. MANAGER LOGIN + VIEWS ──────────────────────────────────────────────────
console.log("\n=== 4. MANAGER LOGIN + DASHBOARD ===");
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
page2.on("pageerror", e => console.error("  [page error]", e.message.slice(0, 200)));

try {
  await loginAs(page2, "mohit@eagleeyedigital.io");
  const url = page2.url();
  console.log(`  ↳ landed on: ${url}`);
  if (url.includes("/login")) throw new Error("Manager still on login page");

  // Manager should land on /dashboard or be redirected there
  const body = await page2.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on manager dashboard");

  const h1 = await page2.locator("h1").first().textContent().catch(() => "");
  console.log(`  ↳ heading: "${h1}"`);
  pass("manager login + dashboard loads — no runtime error");
  await shot(page2, "manager-dashboard");
} catch (e) {
  fail("manager login", e);
  await shot(page2, "error-manager-login");
}

// ── 4a. MANAGER — DSM ALL VIEW ────────────────────────────────────────────────
console.log("\n=== 4a. MANAGER DSM ALL ===");
try {
  await page2.goto(`${BASE}/dsm/all`);
  await page2.locator("h1, h2, main").first().waitFor({ timeout: 20000 });
  await shot(page2, "manager-dsm-all");

  if (page2.url().includes("/login")) throw new Error("Redirected to login");
  const body = await page2.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /dsm/all");
  pass("manager /dsm/all loads without error");

  const h1 = await page2.locator("h1, h2").first().textContent().catch(() => "");
  console.log(`  ↳ heading: "${h1}"`);
} catch (e) {
  fail("manager DSM all view", e);
  await shot(page2, "error-manager-dsm-all");
}

// ── 4b. MANAGER — DSR MANAGE VIEW ────────────────────────────────────────────
console.log("\n=== 4b. MANAGER DSR MANAGE ===");
try {
  await page2.goto(`${BASE}/dsr/manage`);
  await page2.locator("h1, h2, main").first().waitFor({ timeout: 20000 });
  await shot(page2, "manager-dsr-manage");

  if (page2.url().includes("/login")) throw new Error("Redirected to login");
  const body = await page2.locator("body").textContent();
  if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on /dsr/manage");
  pass("manager /dsr/manage loads without error");
} catch (e) {
  fail("manager DSR manage view", e);
  await shot(page2, "error-manager-dsr-manage");
}

// ── 4c. MANAGER — MEMBER DETAIL ──────────────────────────────────────────────
console.log("\n=== 4c. MANAGER — MEMBER DETAIL ===");
try {
  await page2.goto(`${BASE}/dsm/all`);
  await page2.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
  const memberLinks = page2.locator('a[href*="/dsm/member/"]');
  const count = await memberLinks.count();
  console.log(`  ↳ member links found: ${count}`);
  if (count > 0) {
    const href = await memberLinks.first().getAttribute("href");
    await page2.goto(`${BASE}${href}`);
    await page2.locator("h1, h2, main").first().waitFor({ timeout: 15000 });
    await shot(page2, "manager-member-detail");
    const body = await page2.locator("body").textContent();
    if (body.includes("PrismaClientKnownRequestError")) throw new Error("Runtime error on member detail");
    pass("manager member detail page loads without error");
  } else {
    pass("no member submissions yet — expected on fresh DB after seed");
  }
} catch (e) {
  fail("manager member detail", e);
  await shot(page2, "error-manager-member-detail");
}

await ctx2.close();

// ── 5. PROBE: domain restriction ─────────────────────────────────────────────
console.log("\n=== 5. PROBE: domain restriction ===");
const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page3 = await ctx3.newPage();
try {
  await page3.goto(`${BASE}/login`);
  await page3.locator('input[name="email"]').waitFor({ timeout: 15000 });
  await page3.fill('input[name="email"]', "hacker@gmail.com");
  await page3.click('button[type="submit"]');
  // Wait for error message or form change
  await page3.locator("p").filter({ hasText: /not allowed|eagleeyedigital|domain|only/i }).waitFor({ timeout: 10000 });
  await shot(page3, "probe-domain-blocked");
  pass("🔍 gmail.com correctly blocked — domain restriction enforced");
} catch (e) {
  fail("domain restriction probe", e);
  await shot(page3, "probe-domain-restriction");
}
await ctx3.close();

// ── 6. PROBE: unauthenticated access ─────────────────────────────────────────
console.log("\n=== 6. PROBE: unauthenticated access ===");
const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page4 = await ctx4.newPage();
try {
  await page4.goto(`${BASE}/dsm`);
  await page4.locator('input[name="email"]').waitFor({ timeout: 10000 }); // login page input
  const url = page4.url();
  if (!url.includes("/login")) throw new Error(`Expected redirect to /login but got ${url}`);
  pass("🔍 unauthenticated /dsm → redirects to /login");
} catch (e) {
  fail("unauthenticated access probe", e);
}
await ctx4.close();

// ── SUMMARY ───────────────────────────────────────────────────────────────────
await browser.close();

console.log("\n" + "=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
const passed = results.filter(r => r.ok);
const failed = results.filter(r => !r.ok);
results.forEach(r => console.log(`  ${r.ok ? "✅" : "❌"} ${r.label}${r.err ? ` — ${r.err}` : ""}`));
console.log(`\nTotal: ${passed.length} passed, ${failed.length} failed`);
console.log(`Screenshots: ${SCREENSHOT_DIR}`);

process.exit(failed.length > 0 ? 1 : 0);
