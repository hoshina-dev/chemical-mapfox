/**
 * Capture English docs screenshots from prod (retry / fill gaps).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public/docs/en");
const TMP_DIR = join(__dirname, "../public/docs/.tmp-capture");
const BASE = process.env.DOCS_BASE_URL ?? "https://chemfox.ase.cx";
const CLIENT = {
  email: process.env.DOCS_CLIENT_EMAIL ?? "",
  password: process.env.DOCS_CLIENT_PASSWORD ?? "",
};
const STAFF = {
  email: process.env.DOCS_STAFF_EMAIL ?? "",
  password: process.env.DOCS_STAFF_PASSWORD ?? "",
};
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const results = [];

function toWebp(pngPath, id) {
  const out = join(OUT_DIR, `${id}.webp`);
  const r = spawnSync("cwebp", ["-q", "82", "-m", "6", pngPath, "-o", out], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`cwebp ${id}: ${r.stderr}`);
  return out;
}

async function shot(page, id, { fullPage = false, settleMs = 800 } = {}) {
  await page.waitForTimeout(settleMs);
  const png = join(TMP_DIR, `${id}.png`);
  await page.screenshot({ path: png, fullPage });
  toWebp(png, id);
  results.push({ id, ok: true, url: page.url() });
  console.log(`✓ ${id} ← ${page.url()}`);
}

function miss(id, reason) {
  results.push({ id, ok: false, reason });
  console.warn(`✗ ${id} — ${reason}`);
}

async function login(page, { email, password }) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "en", url: BASE },
  ]);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const loginTab = page.getByRole("tab", { name: /sign in|log in/i });
  if ((await loginTab.count()) > 0) await loginTab.click();
  const form = page.locator("form").filter({
    has: page.locator('input[autocomplete="current-password"]'),
  });
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await form.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 30_000,
  });
}

async function clickStatusFilter(page, label) {
  const btn = page.getByRole("button", { name: label, exact: true });
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function openFirstTableRow(page) {
  const row = page.locator("table tbody tr").first();
  if ((await row.count()) === 0) return false;
  await row.click();
  await page.waitForLoadState("networkidle");
  return true;
}

async function captureClient(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-US" });
  const page = await context.newPage();
  await login(page, CLIENT);

  await page.goto(`${BASE}/experiment/listing`, { waitUntil: "networkidle" });
  await shot(page, "client-my-experiments-board");

  await page.goto(`${BASE}/experiment/request/listing`, {
    waitUntil: "networkidle",
  });
  const controls = page.locator(".mantine-Accordion-control");
  if ((await controls.count()) > 0) {
    await controls.first().click();
    await page.waitForTimeout(400);
  }
  await shot(page, "client-request-catalog");

  // Click the green Request button inside the expanded accordion
  const requestBtn = page.getByRole("button", { name: /^Request$/i }).first();
  const requestLink = page.getByRole("link", { name: /^Request$/i }).first();
  if ((await requestBtn.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/experiment\/request\/(?!listing)/, { timeout: 15_000 }),
      requestBtn.click(),
    ]);
    await page.waitForLoadState("networkidle");
    await shot(page, "client-request-intake", { fullPage: true });
  } else if ((await requestLink.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/experiment\/request\/(?!listing)/, { timeout: 15_000 }),
      requestLink.click(),
    ]);
    await page.waitForLoadState("networkidle");
    await shot(page, "client-request-intake", { fullPage: true });
  } else {
    miss("client-request-intake", "No Request control in catalogue");
  }

  // Detail with sample label (Requested)
  await page.goto(`${BASE}/experiment/listing`, { waitUntil: "networkidle" });
  const card = page.locator('a[href*="/experiment/listing/"]').first();
  if ((await card.count()) > 0) {
    const href = await card.getAttribute("href");
    await page.goto(new URL(href, BASE).toString(), { waitUntil: "networkidle" });
    await shot(page, "client-experiment-detail", { fullPage: true });
    if ((await page.getByText(/ship your sample/i).count()) > 0) {
      await page.getByText(/ship your sample/i).first().scrollIntoViewIfNeeded();
      await shot(page, "client-sample-label", { fullPage: true });
    } else {
      miss("client-sample-label", "No sample label on detail");
    }
  }

  // Report: client may only have Requested — leave miss if none
  // Try every card for report actions
  await page.goto(`${BASE}/experiment/listing`, { waitUntil: "networkidle" });
  const cards = page.locator('a[href*="/experiment/listing/"]');
  let gotReport = false;
  for (let i = 0; i < (await cards.count()); i++) {
    const href = await cards.nth(i).getAttribute("href");
    if (!href) continue;
    await page.goto(new URL(href, BASE).toString(), { waitUntil: "networkidle" });
    if (
      (await page.getByRole("link", { name: /view report|download pdf/i }).count()) >
        0 ||
      (await page.getByRole("button", { name: /view report|download pdf/i }).count()) >
        0
    ) {
      await shot(page, "client-report-panel", { fullPage: true });
      gotReport = true;
      break;
    }
  }
  if (!gotReport) miss("client-report-panel", "Client has no report-ready experiment");

  await page.goto(`${BASE}/experiment/settings`, { waitUntil: "networkidle" });
  await shot(page, "client-notification-settings", { fullPage: true });

  await context.close();
}

async function captureStaff(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-US" });
  const page = await context.newPage();
  await login(page, STAFF);

  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  await shot(page, "staff-experiments-listing");

  // Check-in from a Requested ticket
  await clickStatusFilter(page, "Requested");
  if (await openFirstTableRow(page)) {
    const m = page.url().match(/\/internal\/experiment\/([0-9a-f-]{36})/i);
    if (m) {
      await page.goto(`${BASE}/internal/experiment/checkin/${m[1]}`, {
        waitUntil: "networkidle",
      });
      await shot(page, "staff-sample-checkin", { fullPage: true });
    } else {
      miss("staff-sample-checkin", `Opened but URL not workspace: ${page.url()}`);
    }
  } else {
    miss("staff-sample-checkin", "No Requested row");
  }

  // Sample received / start
  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  // Pending group card then Sample received status if present
  const pendingCard = page.getByText(/^Pending$/).first();
  if ((await pendingCard.count()) > 0) {
    await pendingCard.click();
    await page.waitForTimeout(400);
  }
  // Try status button "Sample received" — may not exist; search table text
  let started = false;
  for (const label of ["Sample received", "Open"]) {
    await page.goto(`${BASE}/internal/experiment/listing`, {
      waitUntil: "networkidle",
    });
    if (await clickStatusFilter(page, label)) {
      if (await openFirstTableRow(page)) {
        if ((await page.getByRole("button", { name: /start experiment/i }).count()) > 0) {
          await shot(page, "staff-workspace-start", { fullPage: true });
          started = true;
          break;
        }
      }
    }
  }
  if (!started) {
    // Scan Pending filter group rows for Start experiment
    await page.goto(`${BASE}/internal/experiment/listing`, {
      waitUntil: "networkidle",
    });
    const pendingGroup = page.locator("text=Pending").first();
    if ((await pendingGroup.count()) > 0) await pendingGroup.click();
    await page.waitForTimeout(400);
    const rows = page.locator("table tbody tr");
    for (let i = 0; i < Math.min(await rows.count(), 8); i++) {
      await page.goto(`${BASE}/internal/experiment/listing`, {
        waitUntil: "networkidle",
      });
      const pendingGroup2 = page.getByText("Pending", { exact: true }).first();
      if ((await pendingGroup2.count()) > 0) await pendingGroup2.click();
      await page.waitForTimeout(300);
      await page.locator("table tbody tr").nth(i).click();
      await page.waitForLoadState("networkidle");
      if ((await page.getByRole("button", { name: /start experiment/i }).count()) > 0) {
        await shot(page, "staff-workspace-start", { fullPage: true });
        started = true;
        break;
      }
    }
  }
  if (!started) miss("staff-workspace-start", "No workspace with Start experiment");

  // In progress
  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  await clickStatusFilter(page, "In progress");
  if (await openFirstTableRow(page)) {
    await shot(page, "staff-lab-form-collab", { fullPage: true });
    await shot(page, "staff-workspace-tabs", { fullPage: true });
  } else {
    miss("staff-lab-form-collab", "No In progress row");
    miss("staff-workspace-tabs", "No In progress row");
  }

  // Finalizing
  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  await clickStatusFilter(page, "Finalizing");
  if (await openFirstTableRow(page)) {
    await shot(page, "staff-finalize-panel", { fullPage: true });
  } else {
    miss("staff-finalize-panel", "No Finalizing row");
  }

  // Onboarding
  await page.goto(`${BASE}/internal/experiment/onboarding`, {
    waitUntil: "networkidle",
  });
  await shot(page, "staff-onboarding-samples");

  const sampleCard = page
    .locator('a[href*="/internal/experiment/onboarding/"]')
    .first();
  if ((await sampleCard.count()) > 0) {
    await sampleCard.click();
    await page.waitForLoadState("networkidle");
    await shot(page, "staff-sample-templates");

    // Click template row / link — Density Calculation etc.
    const templateName = page.getByText("Density Calculation").first();
    if ((await templateName.count()) > 0) {
      // Prefer parent link
      const link = page.locator('a').filter({ hasText: "Density Calculation" }).first();
      if ((await link.count()) > 0) {
        await link.click();
      } else {
        await templateName.click();
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      if (page.url().match(/onboarding\/[^/]+\/[^/]+/)) {
        await shot(page, "staff-template-builder", { fullPage: true });
      } else {
        // Try New template flow is wrong; look for any deeper link
        const hrefs = await page.locator("a[href]").evaluateAll((as) =>
          as.map((a) => a.getAttribute("href")).filter(Boolean),
        );
        const builder = hrefs.find((h) =>
          /\/internal\/experiment\/onboarding\/[^/]+\/[^/]+/.test(h),
        );
        if (builder) {
          await page.goto(new URL(builder, BASE).toString(), {
            waitUntil: "networkidle",
          });
          await shot(page, "staff-template-builder", { fullPage: true });
        } else {
          miss(
            "staff-template-builder",
            `Click did not open builder (${page.url()}); hrefs=${hrefs.slice(0, 8).join(",")}`,
          );
        }
      }
    } else {
      miss("staff-template-builder", "No Density Calculation template row");
    }
  }

  // Component reference — prod may still be at /internal/docs (pre-components split)
  for (const path of [
    "/internal/docs/string",
    "/internal/docs",
    "/internal/docs/components",
  ]) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const status = res?.status() ?? 0;
    const body = await page.locator("body").innerText();
    if (status < 400 && !/could not be found/i.test(body)) {
      await shot(page, "staff-component-reference", { fullPage: true });
      break;
    }
  }
  if (!results.some((r) => r.id === "staff-component-reference" && r.ok)) {
    miss(
      "staff-component-reference",
      "Prod docs routes 404 (new docs not deployed yet)",
    );
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    console.log(`Capturing from ${BASE} …`);
    await captureClient(browser);
    await captureStaff(browser);
  } finally {
    await browser.close();
  }
  writeFileSync(
    join(OUT_DIR, "_capture-summary.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("\nSummary:");
  for (const r of results) {
    console.log(r.ok ? `  OK  ${r.id}` : `  MISS ${r.id} — ${r.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
