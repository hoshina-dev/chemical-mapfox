import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
// .../e2e/features/support/config.ts → repo root is three directories up.
const supportDir = path.dirname(__filename);

/** Absolute path to the monorepo root (the chemical-mapfox checkout). */
export const REPO_ROOT = path.resolve(supportDir, "..", "..", "..");

function intEnvOpt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function intEnv(name: string, fallback: number): number {
  return intEnvOpt(name) ?? fallback;
}

/** Optional fixed ports; when unset a free port is picked at runtime. */
export const WEB_PORT_OVERRIDE = intEnvOpt("E2E_WEB_PORT");
export const STUB_PORT_OVERRIDE = intEnvOpt("E2E_STUB_PORT");

/** Optional fixed base URL (reuse an externally-managed app). */
export const BASE_URL_OVERRIDE = process.env.E2E_BASE_URL?.replace(/\/$/, "");

/** When E2E_BASE_URL is set we assume the app is managed externally. */
export const MANAGED_WEB_SERVER = !BASE_URL_OVERRIDE;

/** Shared secret handed to the app so its session cookies verify consistently. */
export const JWT_SECRET = process.env.E2E_JWT_SECRET ?? "e2e-test-secret";

export const HEADLESS = process.env.HEADLESS !== "false";

/** Generous timeout for booting the (on-demand-compiling) Next dev server. */
export const WEB_BOOT_TIMEOUT_MS = intEnv("E2E_WEB_BOOT_TIMEOUT_MS", 180_000);
