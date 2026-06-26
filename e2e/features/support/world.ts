import { setWorldConstructor, World } from "@cucumber/cucumber";
import type { BrowserContext, Page } from "playwright";

import { runtime } from "./runtime.js";

/**
 * Per-scenario world. Holds the Playwright browser context + page; the shared
 * Browser instance lives in the hooks (created once in BeforeAll).
 */
export class ChemFoxWorld extends World {
  context!: BrowserContext;
  page!: Page;

  get baseUrl(): string {
    return runtime.baseUrl;
  }

  /** Navigate to an app-relative path (e.g. "/experiment/listing"). */
  async goto(pathname: string): Promise<void> {
    const target = pathname.startsWith("http")
      ? pathname
      : `${this.baseUrl}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
    await this.page.goto(target, { waitUntil: "domcontentloaded" });
  }

  /** The current path (without origin/query) the browser is on. */
  currentPath(): string {
    return new URL(this.page.url()).pathname;
  }
}

setWorldConstructor(ChemFoxWorld);
