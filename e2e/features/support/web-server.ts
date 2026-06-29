import { type ChildProcess, spawn } from "node:child_process";

import { JWT_SECRET, REPO_ROOT, WEB_BOOT_TIMEOUT_MS } from "./config.js";
import { runtime } from "./runtime.js";

let child: ChildProcess | null = null;

function childEnv(): NodeJS.ProcessEnv {
  const stubBase = `http://127.0.0.1:${runtime.stubPort}`;
  return {
    ...process.env,
    // Point every backend the BFF calls at the in-process stub.
    CUSTAPI_URL: `${stubBase}/api/v1`,
    TICKETING_URL: stubBase,
    EXPERIMENT_MANAGER_URL: stubBase,
    // Collaborative editing uses an in-memory Redis mock in the web app — no
    // external broker required. REDIS_URL is still set so config validation
    // passes; honour an explicit override when provided.
    E2E_REDIS_MOCK: process.env.E2E_REDIS_MOCK ?? "1",
    REDIS_URL: process.env.REDIS_URL ?? "redis://mock",
    JWT_SECRET,
    SESSION_COOKIE_SECURE: "false",
    NODE_ENV: "development",
    PORT: String(runtime.webPort),
    NODE_OPTIONS: "--max-old-space-size=8192",
  };
}

async function waitForReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`web server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${runtime.baseUrl}/`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `web server not ready at ${runtime.baseUrl} within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

export async function startWebServer(): Promise<void> {
  child = spawn(
    "pnpm",
    ["--filter", "web", "exec", "next", "dev", "--port", String(runtime.webPort)],
    {
      cwd: REPO_ROOT,
      env: childEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      // Own process group so we can tear down next's worker children too.
      detached: true,
    },
  );

  const prefix = "[web]";
  child.stdout?.on("data", (d) => process.stdout.write(`${prefix} ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`${prefix} ${d}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      // eslint-disable-next-line no-console
      console.error(`${prefix} process exited with code ${code}`);
    }
  });

  await waitForReady(WEB_BOOT_TIMEOUT_MS);
}

function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

export function stopWebServer(): Promise<void> {
  return new Promise((resolve) => {
    const proc = child;
    if (!proc || proc.exitCode !== null || proc.pid == null) {
      child = null;
      return resolve();
    }
    const pid = proc.pid;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      child = null;
      resolve();
    };
    proc.once("exit", done);
    killGroup(pid, "SIGTERM");
    setTimeout(() => {
      if (!settled) killGroup(pid, "SIGKILL");
    }, 5000);
    setTimeout(done, 8000);
  });
}
