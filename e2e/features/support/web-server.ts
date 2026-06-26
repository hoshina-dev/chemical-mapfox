import { type ChildProcess, spawn } from "node:child_process";

import {
  BASE_URL,
  JWT_SECRET,
  REPO_ROOT,
  STUB_PORT,
  WEB_BOOT_TIMEOUT_MS,
  WEB_PORT,
} from "./config.js";

let child: ChildProcess | null = null;

function childEnv(): NodeJS.ProcessEnv {
  const stubBase = `http://127.0.0.1:${STUB_PORT}`;
  return {
    ...process.env,
    // Point every backend the BFF calls at the in-process stub.
    CUSTAPI_URL: `${stubBase}/api/v1`,
    TICKETING_URL: stubBase,
    EXPERIMENT_MANAGER_URL: stubBase,
    // Unused by the auth flow, but set so nothing reads a real instance.
    REDIS_URL: "redis://127.0.0.1:6399",
    JWT_SECRET,
    SESSION_COOKIE_SECURE: "false",
    NODE_ENV: "development",
    PORT: String(WEB_PORT),
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
      const res = await fetch(`${BASE_URL}/`, { redirect: "manual" });
      // Any HTTP response (200, 3xx redirect, even 500) means it's listening
      // and has compiled the route — good enough to start driving it.
      if (res.status > 0) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `web server not ready at ${BASE_URL} within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

export async function startWebServer(): Promise<void> {
  child = spawn(
    "pnpm",
    ["--filter", "web", "exec", "next", "dev", "--port", String(WEB_PORT)],
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
    // Negative pid targets the whole process group (next dev + its workers).
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
    // Hard cap so a stubborn server can't block the runner from exiting.
    setTimeout(done, 8000);
  });
}
