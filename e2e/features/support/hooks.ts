import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import { type Browser, chromium } from "playwright";

import {
  BASE_URL_OVERRIDE,
  HEADLESS,
  MANAGED_WEB_SERVER,
  STUB_PORT_OVERRIDE,
  WEB_PORT_OVERRIDE,
} from "./config.js";
import { resetDb } from "./fixtures.js";
import { getFreePort } from "./ports.js";
import { setRuntime } from "./runtime.js";
import { resetStubs } from "./stub/registry.js";
import { startStubServer, stopStubServer } from "./stub/server.js";
import { startWebServer, stopWebServer } from "./web-server.js";
import type { ChemFoxWorld } from "./world.js";

// Booting a dev server + navigating on-demand-compiled routes is slow.
setDefaultTimeout(60_000);

let browser: Browser;

BeforeAll(async function () {
  const stubPort = STUB_PORT_OVERRIDE ?? (await getFreePort());
  const webPort = WEB_PORT_OVERRIDE ?? (await getFreePort());
  const baseUrl = BASE_URL_OVERRIDE ?? `http://localhost:${webPort}`;
  setRuntime({ webPort, stubPort, baseUrl });

  await startStubServer(stubPort);
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
  resetStubs();
  this.context = await browser.newContext();
  this.page = await this.context.newPage();
});

After(async function (this: ChemFoxWorld) {
  await this.page?.close();
  await this.context?.close();
});
