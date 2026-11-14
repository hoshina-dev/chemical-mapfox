import { ENGINE_SOURCE } from "./engineSource";

/** Larger engine replies are treated as malformed. */
export const MAX_REPLY_LENGTH = 5_000_000;

/** For embedding in an inline script: no `</script>` can appear. */
function scriptLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Classic worker: a blob module worker fails to start inside an opaque-origin
 * frame (Chromium). Created from a blob inside the frame, it inherits the
 * frame's opaque origin and CSP.
 */
function workerSource(indexUrl: string): string {
  return `
importScripts(${scriptLiteral(`${indexUrl}pyodide.js`)});
let run;
loadPyodide({ indexURL: ${scriptLiteral(indexUrl)} }).then(
  (pyodide) => {
    pyodide.runPython(${scriptLiteral(ENGINE_SOURCE)});
    run = pyodide.globals.get("dry_run_json");
    postMessage("ready");
  },
  (error) => postMessage({ detail: String(error) }),
);
onmessage = (event) => {
  postMessage({ type: "started" });
  try {
    postMessage({ type: "done", out: run(String(event.data)) });
  } catch (error) {
    postMessage({ type: "error", detail: String(error) });
  }
};`;
}

/**
 * Relay between the page and one worker per job. The job's worker is
 * terminated after its single reply (or on cancel), so a formula that escapes
 * Python can't outlive its run, and a spare is started for the next one.
 */
function relaySource(indexUrl: string): string {
  return `
const url = URL.createObjectURL(new Blob([${scriptLiteral(workerSource(indexUrl))}], { type: "text/javascript" }));
const MAX = ${MAX_REPLY_LENGTH};
const reply = (message) => parent.postMessage(message, "*");
let spare = null;
let job = null;

function spawn() {
  const worker = new Worker(url);
  const ready = new Promise((resolve, reject) => {
    worker.onmessage = (event) =>
      event.data === "ready" ? resolve() : reject(String(event.data && event.data.detail));
    worker.onerror = (event) => {
      event.preventDefault();
      reject(event.message || "The engine failed to start");
    };
  });
  ready.catch(() => {});
  return { worker, ready, started: false };
}

function finish(current) {
  current.worker.terminate();
  if (job === current) job = null;
  spare = spare || spawn();
}

addEventListener("message", async (event) => {
  if (event.source !== parent || !event.data) return;
  const { id, body, cancel } = event.data;
  if (typeof cancel === "number") {
    if (job && job.id === cancel) finish(job);
    return;
  }
  if (typeof id !== "number" || typeof body !== "string") return;
  if (job) finish(job);
  const current = Object.assign(spare || spawn(), { id });
  spare = null;
  job = current;
  try {
    await current.ready;
  } catch (error) {
    if (job !== current) return;
    finish(current);
    reply({ id, type: "error", code: "load", detail: String(error).slice(0, 2000) });
    return;
  }
  if (job !== current) return;
  current.worker.onmessage = (message) => {
    if (job !== current) return;
    const data = message.data;
    if (data && data.type === "started") {
      if (!current.started) reply({ id, type: "started" });
      current.started = true;
      return;
    }
    finish(current);
    if (data && data.type === "done" && typeof data.out === "string" && data.out.length <= MAX) {
      reply({ id, type: "done", out: data.out });
    } else {
      const detail = data && typeof data.detail === "string" ? data.detail : "Malformed engine reply";
      reply({ id, type: "error", code: "engine", detail: detail.slice(0, 2000) });
    }
  };
  current.worker.onerror = (failure) => {
    failure.preventDefault();
    if (job !== current) return;
    finish(current);
    reply({ id, type: "error", code: "engine", detail: String(failure.message).slice(0, 2000) });
  };
  current.worker.postMessage(body);
});
reply({ type: "booted" });`;
}

/**
 * The srcdoc of the sandbox frame (`sandbox="allow-scripts"`, so an opaque
 * origin: no session cookie, no storage). Its CSP lets the worker load the
 * runtime and nothing else.
 */
export function sandboxDocument(indexUrl: string): string {
  const csp = [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${indexUrl}`,
    "worker-src blob:",
    `connect-src ${indexUrl}`,
  ].join("; ");
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${relaySource(indexUrl)}</script>`;
}
