import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
// .../e2e/features/support/config.ts → repo root is three directories up.
const supportDir = path.dirname(__filename);

/** Absolute path to the monorepo root (the chemical-mapfox checkout). */
export const REPO_ROOT = path.resolve(supportDir, "..", "..", "..");

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Port the Next.js app under test listens on (its own, to avoid clashing with `pnpm dev`). */
export const WEB_PORT = intEnv("E2E_WEB_PORT", 3100);

/** Port the in-process backend stub (custapi + ticketing + experiment-manager) listens on. */
export const STUB_PORT = intEnv("E2E_STUB_PORT", 4555);

/**
 * Base URL Playwright drives. Override with E2E_BASE_URL to reuse an
 * already-running app. Note: we use `localhost` (not 127.0.0.1) on purpose —
 * Next 16's dev server blocks cross-origin `/_next/*` resources, and it treats
 * a 127.0.0.1 request against its `localhost` origin as cross-origin, which
 * silently breaks client hydration.
 */
export const BASE_URL =
  process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? `http://localhost:${WEB_PORT}`;

/** When E2E_BASE_URL is set we assume the app + stub are managed externally. */
export const MANAGED_WEB_SERVER = !process.env.E2E_BASE_URL;

/** Shared secret handed to the app so its session cookies verify consistently. */
export const JWT_SECRET = process.env.E2E_JWT_SECRET ?? "e2e-test-secret";

export const HEADLESS = process.env.HEADLESS !== "false";

/** Generous timeout for booting the (on-demand-compiling) Next dev server. */
export const WEB_BOOT_TIMEOUT_MS = intEnv("E2E_WEB_BOOT_TIMEOUT_MS", 180_000);
