// Serve the Pyodide runtime from public/pyodide/<version>/ (gitignored) so the
// calculation worker loads it same-origin. Runs before dev and build.
import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { version } = require("pyodide/package.json");
const source = dirname(require.resolve("pyodide/package.json"));
const root = join(dirname(fileURLToPath(import.meta.url)), "../public/pyodide");
const target = join(root, version);

const FILES = [
  "pyodide.mjs",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

await rm(root, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await Promise.all(FILES.map((file) => copyFile(join(source, file), join(target, file))));
console.log(`Pyodide ${version} → public/pyodide/${version}`);
