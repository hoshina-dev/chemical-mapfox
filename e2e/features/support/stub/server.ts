import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { dispatch } from "./registry.js";
import type { StubContext } from "./types.js";

/**
 * A single HTTP server standing in for every backend the BFF calls server-side
 * (custapi, ticketing-service, experiment-manager). The app is configured (via
 * env) to point CUSTAPI_URL / TICKETING_URL / EXPERIMENT_MANAGER_URL here.
 *
 * Behaviour lives in auto-loaded modules under `./modules/*`; this file only
 * wires HTTP ↔ the module registry, plus a benign empty-list/object fallback so
 * unmodelled best-effort listing calls don't crash a page.
 */

let server: http.Server | null = null;
let modulesLoaded = false;

async function loadModules(): Promise<void> {
  if (modulesLoaded) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = path.join(here, "modules");
  const files = fs
    .readdirSync(dir)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"))
    .sort();
  for (const file of files) {
    await import(pathToFileURL(path.join(dir, file)).href);
  }
  modulesLoaded = true;
}

function makeContext(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): StubContext {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const segments = url.pathname.split("/").filter(Boolean);
  const [p0, p1, ...rest] = segments;
  const path_ = p0 === "api" && p1 === "v1" ? rest : segments;

  let bodyPromise: Promise<unknown> | null = null;
  return {
    method: req.method ?? "GET",
    path: path_,
    url,
    readBody() {
      if (!bodyPromise) {
        bodyPromise = new Promise((resolve) => {
          const chunks: Buffer[] = [];
          req.on("data", (c) => chunks.push(c as Buffer));
          req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            if (!raw) return resolve({});
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve({});
            }
          });
        });
      }
      return bodyPromise;
    },
    json(status, body) {
      const payload = JSON.stringify(body ?? null);
      res.writeHead(status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      });
      res.end(payload);
      return true;
    },
  };
}

export async function startStubServer(port: number): Promise<void> {
  await loadModules();
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const ctx = makeContext(req, res);
      dispatch(ctx)
        .then((handled) => {
          if (handled) return;
          // Benign fallback: empty list for GETs, empty object otherwise.
          ctx.json(200, ctx.method === "GET" ? [] : {});
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[stub] handler error", err);
          if (!res.headersSent) ctx.json(500, { error: "stub error" });
        });
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

export function stopStubServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server = null;
  });
}
