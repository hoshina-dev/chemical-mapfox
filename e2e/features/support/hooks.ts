import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import { type Browser, chromium } from "playwright";

import { HEADLESS, MANAGED_WEB_SERVER, STUB_PORT } from "./config.js";
import { resetDb } from "./fixtures.js";
import { startStubServer, stopStubServer } from "./stub-server.js";
import { startWebServer, stopWebServer } from "./web-server.js";
import type { ChemFoxWorld } from "./world.js";

// Booting a dev server + navigating on-demand-compiled routes is slow.
setDefaultTimeout(60_000);

let browser: Browser;

BeforeAll(async function () {
  await startStubServer(STUB_PORT);
  if (MANAGED_WEB_SERVER) {
    await startWebServer();
  }
  browser = await chromium.launch({ headless: HEADLESS });
});

AfterAll(async function () {
  await browser?.close();
  if (MANAGED_WEB_SERVER) {
    await stopWebServer();
  }
  await stopStubServer();
});

Before(async function (this: ChemFoxWorld) {
  resetDb();
  this.context = await browser.newContext();
  this.page = await this.context.newPage();
});

After(async function (this: ChemFoxWorld) {
  await this.page?.close();
  await this.context?.close();
});
