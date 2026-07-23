import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";
import type { Locator, Page } from "playwright";

import type { ChemFoxWorld } from "../support/world.js";

type UiLocale = "en" | "pl" | "th";

const LOCALE_COOKIE = "NEXT_LOCALE";

/** Landing H1 hero title per locale (`landing.hero.title`). */
const LANDING_HERO: Record<UiLocale, string> = {
  en: "Chemical experiments, from request to certified results.",
  pl: "Eksperymenty chemiczne — od zgłoszenia do certyfikowanych wyników.",
  th: "การทดลองทางเคมี ตั้งแต่การร้องขอจนถึงผลลัพธ์ที่ได้รับการรับรอง",
};

/** Auth card subtitle per locale (`auth.card.subtitle`). */
const AUTH_SUBTITLE: Record<UiLocale, string> = {
  en: "Sign in or create an account to continue.",
  pl: "Zaloguj się lub utwórz konto, aby kontynuować.",
  th: "เข้าสู่ระบบหรือสร้างบัญชีเพื่อดำเนินการต่อ",
};

function isUiLocale(value: string): value is UiLocale {
  return value === "en" || value === "pl" || value === "th";
}

/**
 * Locate the language <select> by its option values (stable across locales),
 * not by aria-label (which itself is translated).
 */
function languageSwitcher(page: Page): Locator {
  return page.locator("select").filter({
    has: page.locator('option[value="en"]'),
  }).filter({
    has: page.locator('option[value="pl"]'),
  }).filter({
    has: page.locator('option[value="th"]'),
  }).first();
}

When(
  "I switch the UI language to {string}",
  async function (this: ChemFoxWorld, locale: string) {
    assert.ok(isUiLocale(locale), `Unknown locale "${locale}"`);
    const switcher = languageSwitcher(this.page);
    await switcher.waitFor({ state: "visible", timeout: 15_000 });
    // Wait for client hydration — selecting too early changes the DOM value
    // without firing the React onChange that persists NEXT_LOCALE.
    await this.page.waitForFunction(
      () => {
        const select = [...document.querySelectorAll("select")].find((el) => {
          const values = [...el.options].map((o) => o.value);
          return (
            values.includes("en") &&
            values.includes("pl") &&
            values.includes("th")
          );
        });
        return select instanceof HTMLSelectElement && !select.disabled;
      },
      undefined,
      { timeout: 15_000 },
    );
    await switcher.selectOption(locale);
    // setLocaleAction + router.refresh(); <html lang> updates with the locale.
    await this.page.waitForFunction(
      (next) => document.documentElement.lang === next,
      locale,
      { timeout: 15_000 },
    );
    assert.equal(await languageSwitcher(this.page).inputValue(), locale);
  },
);

When("I reload the page", async function (this: ChemFoxWorld) {
  await this.page.reload({ waitUntil: "domcontentloaded" });
});

Then(
  "the UI language should be {string}",
  async function (this: ChemFoxWorld, locale: string) {
    assert.ok(isUiLocale(locale), `Unknown locale "${locale}"`);
    await this.page.waitForFunction(
      (next) => document.documentElement.lang === next,
      locale,
      { timeout: 15_000 },
    );
    const switcher = languageSwitcher(this.page);
    await switcher.waitFor({ state: "visible", timeout: 15_000 });
    assert.equal(await switcher.inputValue(), locale);
  },
);

Then(
  "I should see the landing hero in {string}",
  async function (this: ChemFoxWorld, locale: string) {
    assert.ok(isUiLocale(locale), `Unknown locale "${locale}"`);
    await this.page
      .getByRole("heading", { name: LANDING_HERO[locale], level: 1 })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "I should see the sign-in form in {string}",
  async function (this: ChemFoxWorld, locale: string) {
    assert.ok(isUiLocale(locale), `Unknown locale "${locale}"`);
    await this.page
      .getByText(AUTH_SUBTITLE[locale], { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the preferred locale cookie should be {string}",
  async function (this: ChemFoxWorld, locale: string) {
    assert.ok(isUiLocale(locale), `Unknown locale "${locale}"`);
    const cookies = await this.context.cookies();
    const match = cookies.find((cookie) => cookie.name === LOCALE_COOKIE);
    assert.ok(match, `Missing ${LOCALE_COOKIE} cookie`);
    assert.equal(match.value, locale);
  },
);
