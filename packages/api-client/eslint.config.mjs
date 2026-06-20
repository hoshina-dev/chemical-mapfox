import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: [
      "src/custapi/**",
      "src/ticketing/**",
      "src/experiment-manager.d.ts",
      "dist/**",
    ],
  },
];
