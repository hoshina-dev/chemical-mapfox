// esbuild bundles Next.js internals that access process.env.* at module eval
// time. In a browser IIFE there's no process global, so we shim it here.
// This file is imported first in index.ts so it evaluates before next/link
// and next/navigation modules.
if (typeof (globalThis as any).process === "undefined") {
  (globalThis as any).process = { env: {} };
}
