/// <reference lib="webworker" />
import type { PyodideInterface } from "pyodide";

import { ENGINE_SOURCE } from "./engineSource";
import type { WorkerReply, WorkerRequest } from "./protocol";

const INDEX_URL = `/pyodide/${process.env.NEXT_PUBLIC_PYODIDE_VERSION}/`;

let engine: Promise<(body: string) => string> | null = null;

async function loadEngine(): Promise<(body: string) => string> {
  // Served from public/ (scripts/copy-pyodide.mjs), not bundled.
  const moduleUrl = `${INDEX_URL}pyodide.mjs`;
  const { loadPyodide } = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ moduleUrl
  )) as { loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInterface> };
  const pyodide = await loadPyodide({ indexURL: INDEX_URL });
  pyodide.runPython(ENGINE_SOURCE);
  const dryRun = pyodide.globals.get("dry_run_json") as (body: string) => string;
  return (body) => dryRun(body);
}

const post = (reply: WorkerReply) => self.postMessage(reply);

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  let run: (body: string) => string;
  try {
    engine ??= loadEngine();
    run = await engine;
  } catch (error) {
    engine = null;
    post({ id: data.id, type: "error", code: "load", detail: String(error) });
    return;
  }
  // The caller's time limit starts here, so a cold load doesn't eat into it.
  post({ id: data.id, type: "started" });
  try {
    const { report, values, calculations } = JSON.parse(run(data.body));
    post({
      id: data.id,
      type: "done",
      evaluation: { report, valuesJson: values, calculationsJson: calculations },
    });
  } catch (error) {
    post({ id: data.id, type: "error", code: "engine", detail: String(error) });
  }
};
