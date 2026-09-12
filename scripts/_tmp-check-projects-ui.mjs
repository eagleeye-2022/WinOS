import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const SCREENSHOT_DIR = "C:\\Users\\mohit\\AppData\\Local\\Temp\\claude\\c--Users-mohit-OneDrive-Documents-Desktop-winos-WinOS\\f8d286da-1881-4b38-a94a-b27f31f7d7e9\\scratchpad\\shots";
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let stepCount = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOT_DIR, `${String(++stepCount).padStart(2, "0")}-${label.replace(/[^a-z0-9]/gi, "_")}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  screenshot: ${file}`);
  return file;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message.slice(0, 300)));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("[console error]", msg.text().slice(0, 300));
});

try {
  await page.goto(`${BASE}/login`);
  await page.locator('input[name="email"]').waitFor({ timeout: 30000 });
  await page.fill('input[name="email"]', "mohit@eagleeyedigital.io");
  await page.click('button[type="submit"]');
  await page.locator('input[name="otp"]').waitFor({ timeout: 30000 });

  const devOtpEl = page.locator("p strong").filter({ hasText: /^\d{6}$/ });
  await devOtpEl.waitFor({ timeout: 10000 });
  const otp = (await devOtpEl.textContent()).trim();
  console.log(`OTP: ${otp}`);
  await page.fill('input[name="otp"]', otp);

  await Promise.all([
    page.waitForURL((url) => !url.href.includes("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log("Logged in, landed on:", page.url());

  await page.goto(`${BASE}/projects`);
  await page.locator("table").first().waitFor({ timeout: 30000 });
  await shot(page, "projects-table");

  // Click first "Unassigned" trigger in the table
  const unassignedBtn = page.locator('button:has-text("Unassigned")').first();
  if (await unassignedBtn.count() > 0) {
    await unassignedBtn.click();
    await page.waitForTimeout(400);
    await shot(page, "assignee-popover");
  } else {
    console.log("No 'Unassigned' button found on the page.");
  }

  await page.keyboard.press("Escape");
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);

  // Click first calendar / "Set dates" trigger
  const calBtn = page.locator('button:has-text("Set dates")').first();
  const anyCalBtn = (await calBtn.count()) > 0 ? calBtn : page.locator("button", { hasText: /–/ }).first();
  if (await anyCalBtn.count() > 0) {
    await anyCalBtn.click();
    await page.waitForTimeout(400);
    await shot(page, "calendar-popover");
  } else {
    console.log("No calendar trigger button found on the page.");
  }
} catch (e) {
  console.error("ERROR:", e);
  await shot(page, "error-state");
} finally {
  await browser.close();
}
