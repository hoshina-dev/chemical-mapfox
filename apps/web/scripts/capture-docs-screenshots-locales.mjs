/**
 * Capture docs screenshots for pl + th by switching the navbar language.
 *
 * Env: DOCS_BASE_URL, DOCS_CLIENT_EMAIL, DOCS_CLIENT_PASSWORD,
 *      DOCS_STAFF_EMAIL, DOCS_STAFF_PASSWORD
 * Optional: DOCS_LOCALES=pl,th
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DOCS = join(__dirname, "../public/docs");
const TMP_DIR = join(PUBLIC_DOCS, ".tmp-capture");
const BASE = process.env.DOCS_BASE_URL ?? "https://chemfox.ase.cx";
const CLIENT = {
  email: process.env.DOCS_CLIENT_EMAIL ?? "",
  password: process.env.DOCS_CLIENT_PASSWORD ?? "",
};
const STAFF = {
  email: process.env.DOCS_STAFF_EMAIL ?? "",
  password: process.env.DOCS_STAFF_PASSWORD ?? "",
};
const LOCALES = (process.env.DOCS_LOCALES ?? "pl,th")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const VIEWPORT = { width: 1440, height: 900 };

// Known prod fixtures from the English capture pass
const SAMPLE_APPLE = "3bb975da-e29c-4e6b-86ab-fe9f0a5f289b";
const TEMPLATE_DENSITY = "84a2f484-1ca3-41e2-81df-2fd58cfac012";
const CLIENT_REQUESTED = "529932bb-5c89-4b15-b19f-5d4a8fe6f1f0";
const STAFF_CHECKED_IN = "e0af448e-ad77-4ce8-be9b-ca0761dce058";

mkdirSync(TMP_DIR, { recursive: true });

function toWebp(pngPath, locale, id) {
  const outDir = join(PUBLIC_DOCS, locale);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${id}.webp`);
  const r = spawnSync("cwebp", ["-q", "82", "-m", "6", pngPath, "-o", out], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`cwebp ${locale}/${id}: ${r.stderr}`);
  return out;
}

async function shot(page, locale, id, { fullPage = true, settleMs = 900 } = {}) {
  await page.waitForTimeout(settleMs);
  const png = join(TMP_DIR, `${locale}-${id}.png`);
  await page.screenshot({ path: png, fullPage });
  toWebp(png, locale, id);
  console.log(`✓ ${locale}/${id}.webp ← ${page.url()}`);
}

async function login(page, user) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const form = page.locator("form").filter({
    has: page.locator('input[autocomplete="current-password"]'),
  });
  await form.locator('input[name="email"]').fill(user.email);
  await form.locator('input[name="password"]').fill(user.password);
  await form.getByRole("button", { name: /sign in|log in|zaloguj|เข้าสู่ระบบ/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 30_000,
  });
}

/**
 * Switch locale via the navbar NativeSelect (LanguageSwitcher).
 * Falls back to setting the NEXT_LOCALE cookie + reload if needed.
 */
async function switchLocale(page, locale) {
  const select = page.getByLabel(/language|język|ภาษา/i).or(
    page.locator('nav select, header select, [aria-label] >> select').first(),
  );

  // Prefer the visible Mantine NativeSelect in the chrome
  const native = page.locator("header select, nav select, select").first();
  const target = (await page.locator("header select").count())
    ? page.locator("header select").first()
    : (await page.locator("nav select").count())
      ? page.locator("nav select").first()
      : page.locator("select").first();

  await target.selectOption(locale);
  // setLocaleAction + router.refresh — give SSR time
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });

  // Verify cookie
  const cookies = await page.context().cookies(BASE);
  const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
  if (localeCookie?.value !== locale) {
    await page.context().addCookies([
      { name: "NEXT_LOCALE", value: locale, url: BASE },
    ]);
    await page.reload({ waitUntil: "networkidle" });
  }
  console.log(`  locale → ${locale} (cookie=${localeCookie?.value ?? "set"})`);
}

async function gotoQuiet(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
}

async function contextIdsOnPage(page) {
  const text = await page.locator("body").innerText();
  return [
    ...new Set(
      text.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ) ?? [],
    ),
  ];
}

async function captureClientLocale(browser, locale) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: locale === "th" ? "th-TH" : locale === "pl" ? "pl-PL" : "en-US",
  });
  const page = await context.newPage();
  await login(page, CLIENT);
  await switchLocale(page, locale);

  await page.goto(`${BASE}/experiment/listing`, { waitUntil: "networkidle" });
  await shot(page, locale, "client-my-experiments-board", { fullPage: false });

  await page.goto(`${BASE}/experiment/request/listing`, {
    waitUntil: "networkidle",
  });
  const accordion = page.locator(".mantine-Accordion-control");
  if ((await accordion.count()) > 0) {
    await accordion.first().click();
    await page.waitForTimeout(400);
  }
  await shot(page, locale, "client-request-catalog", { fullPage: false });

  // Prefer a short catalogue "Request" control inside the accordion; otherwise
  // open the known Density Calculation template directly (labels differ by locale).
  const panelRequest = page
    .locator(".mantine-Accordion-panel")
    .getByRole("button", { name: /^(Request|Zamów|ขอทำการทดลอง)$/i })
    .first();
  if ((await panelRequest.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/experiment\/request\/(?!listing)/, { timeout: 15_000 }),
      panelRequest.click(),
    ]);
    await page.waitForLoadState("networkidle");
  } else {
    await page.goto(
      `${BASE}/experiment/request/${TEMPLATE_DENSITY}?sampleId=${SAMPLE_APPLE}`,
      { waitUntil: "networkidle" },
    );
  }
  await shot(page, locale, "client-request-intake");

  await page.goto(`${BASE}/experiment/listing/${CLIENT_REQUESTED}`, {
    waitUntil: "networkidle",
  });
  await shot(page, locale, "client-experiment-detail");
  await shot(page, locale, "client-sample-label");

  await page.goto(`${BASE}/experiment/settings`, { waitUntil: "networkidle" });
  await shot(page, locale, "client-notification-settings");

  await context.close();
}

async function captureStaffLocale(browser, locale) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: locale === "th" ? "th-TH" : locale === "pl" ? "pl-PL" : "en-US",
  });
  const page = await context.newPage();
  await login(page, STAFF);
  await switchLocale(page, locale);

  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  await shot(page, locale, "staff-experiments-listing", { fullPage: false });

  // Check-in: prefer a still-Requested ticket if any; else known id
  const ids = await contextIdsOnPage(page);
  let checkinId = STAFF_CHECKED_IN;
  // Try filter button — labels vary by locale
  for (const label of ["Requested", "Zgłoszono", "ร้องขอแล้ว"]) {
    const btn = page.getByRole("button", { name: label, exact: true });
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForTimeout(400);
      const filtered = await contextIdsOnPage(page);
      if (filtered.length) checkinId = filtered[0];
      break;
    }
  }
  await page.goto(`${BASE}/internal/experiment/checkin/${checkinId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);
  await shot(page, locale, "staff-sample-checkin");

  // Start experiment workspace (checked-in earlier)
  await gotoQuiet(page, `${BASE}/internal/experiment/${STAFF_CHECKED_IN}`);
  await shot(page, locale, "staff-workspace-start");

  // In progress — use status pill if possible, else scan
  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  let inProgressId = null;
  for (const label of ["In progress", "W toku", "กำลังดำเนินการ"]) {
    const btn = page.getByRole("button", { name: label, exact: true });
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForTimeout(400);
      const found = await contextIdsOnPage(page);
      if (found.length) {
        inProgressId = found[0];
        break;
      }
    }
  }
  if (!inProgressId) {
    // Known from English pass
    inProgressId = "6ca6f535-31db-43d2-a3b0-77dda3074f17";
  }
  await gotoQuiet(page, `${BASE}/internal/experiment/${inProgressId}`);
  await shot(page, locale, "staff-lab-form-collab");
  await shot(page, locale, "staff-workspace-tabs");

  // Finalizing
  let finalizingId = "7642841e-46df-45fd-9589-d26387bb7f20";
  await page.goto(`${BASE}/internal/experiment/listing`, {
    waitUntil: "networkidle",
  });
  for (const label of ["Finalizing", "Finalizowanie", "กำลังสรุปผล"]) {
    const btn = page.getByRole("button", { name: label, exact: true });
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForTimeout(400);
      const found = await contextIdsOnPage(page);
      if (found.length) {
        finalizingId = found[0];
        break;
      }
    }
  }
  await gotoQuiet(page, `${BASE}/internal/experiment/${finalizingId}`);
  await shot(page, locale, "staff-finalize-panel");

  // Onboarding
  await page.goto(`${BASE}/internal/experiment/onboarding`, {
    waitUntil: "networkidle",
  });
  await shot(page, locale, "staff-onboarding-samples", { fullPage: false });

  await page.goto(`${BASE}/internal/experiment/onboarding/${SAMPLE_APPLE}`, {
    waitUntil: "networkidle",
  });
  await shot(page, locale, "staff-sample-templates", { fullPage: false });

  await page.goto(
    `${BASE}/internal/experiment/onboarding/${SAMPLE_APPLE}/${TEMPLATE_DENSITY}`,
    { waitUntil: "networkidle" },
  );
  await shot(page, locale, "staff-template-builder");

  // Component reference — prod gallery type page
  for (const path of ["/internal/docs/string", "/internal/docs"]) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const text = await page.locator("body").innerText();
    if ((res?.status() ?? 500) < 400 && !/could not be found|nie znaleziono|ไม่พบ/i.test(text)) {
      await shot(page, locale, "staff-component-reference");
      break;
    }
  }

  await context.close();
}

async function main() {
  if (!CLIENT.email || !STAFF.email) {
    console.error("Missing credentials");
    process.exit(1);
  }
  console.log(`Locales: ${LOCALES.join(", ")} @ ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of LOCALES) {
      console.log(`\n=== ${locale} ===`);
      await captureClientLocale(browser, locale);
      await captureStaffLocale(browser, locale);
    }
  } finally {
    await browser.close();
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
