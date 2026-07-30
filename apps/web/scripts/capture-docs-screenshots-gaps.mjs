/**
 * Fill remaining / broken English docs screenshots from prod.
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

async function shot(page, id, { fullPage = true, settleMs = 800 } = {}) {
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

/** Collect UUID-looking context ids visible on the staff listing. */
async function contextIdsOnPage(page) {
  const text = await page.locator("body").innerText();
  const ids = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  );
  return [...new Set(ids ?? [])];
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- Staff gap fills ---
  {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      locale: "en-US",
    });
    const page = await context.newPage();
    await login(page, STAFF);

    await page.goto(`${BASE}/internal/experiment/listing`, {
      waitUntil: "networkidle",
    });

    // Filter Requested and open via first experiment title cell
    await page.getByRole("button", { name: "Requested", exact: true }).click();
    await page.waitForTimeout(500);
    const requestedIds = await contextIdsOnPage(page);
    console.log("Requested context ids:", requestedIds);

    if (requestedIds.length > 0) {
      const id = requestedIds[0];
      await page.goto(`${BASE}/internal/experiment/checkin/${id}`, {
        waitUntil: "networkidle",
      });
      const body = await page.locator("body").innerText();
      if (!/could not be found/i.test(body)) {
        await shot(page, "staff-sample-checkin");
      } else {
        miss("staff-sample-checkin", "Check-in page 404");
      }
    } else {
      miss("staff-sample-checkin", "No Requested ids on listing");
    }

    // Find Sample received / Start experiment by probing pending ids
    await page.goto(`${BASE}/internal/experiment/listing`, {
      waitUntil: "networkidle",
    });
    // Click Pending group filter card
    await page.locator("button").filter({ hasText: /^Pending/ }).first().click();
    await page.waitForTimeout(500);
    const pendingIds = await contextIdsOnPage(page);
    console.log("Pending context ids:", pendingIds);

    let foundStart = false;
    for (const id of pendingIds) {
      await page.goto(`${BASE}/internal/experiment/${id}`, {
        waitUntil: "networkidle",
      });
      if (
        (await page.getByRole("button", { name: /start experiment/i }).count()) >
        0
      ) {
        await shot(page, "staff-workspace-start");
        foundStart = true;
        break;
      }
    }
    if (!foundStart) {
      miss(
        "staff-workspace-start",
        "No pending ticket shows Start experiment (may have no Sample received)",
      );
    }

    // Template builder — click tbody tr with force, wait for URL
    await page.goto(
      `${BASE}/internal/experiment/onboarding/3bb975da-e29c-4e6b-86ab-fe9f0a5f289b`,
      { waitUntil: "networkidle" },
    );
    await page.locator("table tbody tr").first().click({ force: true });
    try {
      await page.waitForURL(/\/onboarding\/[^/]+\/[^/]+/, { timeout: 10_000 });
      await page.waitForLoadState("networkidle");
      await shot(page, "staff-template-builder");
    } catch {
      // Probe hrefs / try Coal sample which has more templates
      await page.goto(`${BASE}/internal/experiment/onboarding`, {
        waitUntil: "networkidle",
      });
      const coal = page.getByRole("link", { name: /Coal/i }).first();
      if ((await coal.count()) > 0) {
        await coal.click();
        await page.waitForLoadState("networkidle");
      } else {
        // Cards may not be links — click text
        await page.getByText("Coal", { exact: true }).first().click();
        await page.waitForLoadState("networkidle");
      }
      await page.waitForTimeout(800);
      console.log("On sample page:", page.url());
      const row = page.locator("table tbody tr").first();
      if ((await row.count()) > 0) {
        await Promise.all([
          page
            .waitForURL(/\/onboarding\/[^/]+\/[^/]+/, { timeout: 10_000 })
            .catch(() => null),
          row.click({ force: true }),
        ]);
        await page.waitForTimeout(1500);
        if (/\/onboarding\/[^/]+\/[^/]+/.test(page.url())) {
          await shot(page, "staff-template-builder");
        } else {
          miss("staff-template-builder", `Still on ${page.url()}`);
        }
      } else {
        miss("staff-template-builder", "No template rows");
      }
    }

    // Component reference on prod
    let docsOk = false;
    for (const path of ["/internal/docs/string", "/internal/docs"]) {
      const res = await page.goto(`${BASE}${path}`, {
        waitUntil: "networkidle",
      });
      const text = await page.locator("body").innerText();
      if ((res?.status() ?? 500) < 400 && !/could not be found/i.test(text)) {
        await shot(page, "staff-component-reference");
        docsOk = true;
        break;
      }
    }
    if (!docsOk) {
      miss(
        "staff-component-reference",
        "Prod /internal/docs not available (deploy docs first)",
      );
    }

    await context.close();
  }

  // --- Client report: only if another experiment appears ---
  {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      locale: "en-US",
    });
    const page = await context.newPage();
    await login(page, CLIENT);
    await page.goto(`${BASE}/experiment/listing`, { waitUntil: "networkidle" });
    // Already know client01 only has Requested — confirm miss unless new data
    const cards = page.locator('a[href*="/experiment/listing/"]');
    let got = false;
    for (let i = 0; i < (await cards.count()); i++) {
      const href = await cards.nth(i).getAttribute("href");
      await page.goto(new URL(href, BASE).toString(), {
        waitUntil: "networkidle",
      });
      if (
        (await page.getByRole("link", { name: /view report|download pdf/i }).count()) >
          0 ||
        (await page.getByRole("button", { name: /view report|download pdf/i }).count()) >
          0
      ) {
        await shot(page, "client-report-panel");
        got = true;
        break;
      }
    }
    if (!got) {
      miss(
        "client-report-panel",
        "client01 has no completed experiment with a report — needs seed data or another account",
      );
    }
    await context.close();
  }

  await browser.close();
  writeFileSync(
    join(OUT_DIR, "_capture-summary-gaps.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("\nGap fill summary:");
  for (const r of results) {
    console.log(r.ok ? `  OK  ${r.id}` : `  MISS ${r.id} — ${r.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
