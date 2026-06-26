/**
 * Cucumber configuration. TypeScript support is provided by running the
 * Cucumber binary under `node --import tsx` (see package.json scripts), so the
 * `.ts` support and step-definition files imported below are transpiled on the
 * fly — no separate build step.
 */
export default {
  paths: ["features/**/*.feature"],
  import: [
    "features/support/**/*.ts",
    "features/step_definitions/**/*.ts",
  ],
  format: ["progress-bar", "summary"],
  formatOptions: { snippetInterface: "async-await" },
};
