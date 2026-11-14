import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["scripts/**", "public/pyodide/**"],
  },
  ...nextJsConfig,
];
