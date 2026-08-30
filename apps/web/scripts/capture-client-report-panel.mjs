/**
 * Capture client-report-panel.webp for en/pl from a known detail page.
 *
 * Env overrides:
 *   DOCS_BASE_URL, DOCS_CLIENT_EMAIL, DOCS_CLIENT_PASSWORD, DOCS_LOCALES
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_BASE = join(__dirname, "../public/docs");
const TMP = join(OUT_BASE, ".tmp-capture");
const BASE = process.env.DOCS_BASE_URL ?? "https://chemfox.ase.cx";
const DETAIL =
  process.env.DOCS_DETAIL_PATH ??
  "/experiment/listing/159c7177-885f-4b80-848e-4407d93c638e";
const EMAIL = process.env.DOCS_CLIENT_EMAIL ?? "";
const PASSWORD = process.env.DOCS_CLIENT_PASSWORD ?? "";
const LOCALES = (process.env.DOCS_LOCALES ?? "en,pl")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const VIEWPORT = { width: 1440, height: 900 };

if (!EMAIL || !PASSWORD) {
  console.error(
    "Set DOCS_CLIENT_EMAIL and DOCS_CLIENT_PASSWORD (no defaults).",
  );
  process.exit(1);
}

mkdirSync(TMP, { recursive: true });

function toWebp(pngPath, locale) {
  const outDir = join(OUT_BASE, locale);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "client-report-panel.webp");
  const r = spawnSync("cwebp", ["-q", "82", "-m", "6", pngPath, "-o", out], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  console.log(`✓ ${locale}/client-report-panel.webp ← ${DETAIL}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const form = page.locator("form").filter({
    has: page.locator('input[autocomplete="current-password"]'),
  });
  await form.locator('input[name="email"]').fill(EMAIL);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form
    .getByRole("button", { name: /sign in|log in|zaloguj/i })
    .click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 30_000,
  });
}

async function switchLocale(page, locale) {
  const select = (await page.locator("header select").count())
    ? page.locator("header select").first()
    : page.locator("select").first();
  await select.selectOption(locale);
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  const cookies = await page.context().cookies(BASE);
  if (cookies.find((c) => c.name === "NEXT_LOCALE")?.value !== locale) {
    await page.context().addCookies([
      { name: "NEXT_LOCALE", value: locale, url: BASE },
    ]);
    await page.reload({ waitUntil: "networkidle" });
  }
  console.log(`  locale → ${locale}`);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const locale of LOCALES) {
    console.log(`\n=== ${locale} ===`);
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      locale: locale === "pl" ? "pl-PL" : "en-US",
    });
    const page = await ctx.newPage();
    await login(page);
    if (locale !== "en") {
      await switchLocale(page, locale);
    } else {
      await page.context().addCookies([
        { name: "NEXT_LOCALE", value: "en", url: BASE },
      ]);
    }

    await page.goto(`${BASE}${DETAIL}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);

    const report = page
      .getByRole("heading", { name: /report|raport|รายงาน/i })
      .first();
    if (await report.count()) await report.scrollIntoViewIfNeeded();

    // Sanity: page should not 404 / not-found
    const body = await page.locator("body").innerText();
    if (/could not be found|nie znaleziono|ไม่พบ/i.test(body)) {
      throw new Error(`Detail page not found for locale=${locale}: ${DETAIL}`);
    }

    const png = join(TMP, `${locale}-client-report-panel.png`);
    await page.screenshot({ path: png, fullPage: true });
    toWebp(png, locale);
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log("\nDone.");
