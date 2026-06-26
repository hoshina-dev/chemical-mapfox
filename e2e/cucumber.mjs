/**
 * Cucumber configuration. TypeScript support is provided by running the
 * Cucumber binary under `node --import tsx` (see package.json scripts), so the
 * `.ts` support and step-definition files imported below are transpiled on the
 * fly — no separate build step.
 *
 * Only the hook/world entry points and step definitions are imported here;
 * everything else (config, fixtures, the stub server + its auto-loaded
 * `stub/modules/*`) is pulled in transitively. Importantly the stub modules are
 * loaded by the stub server at runtime, NOT globbed here, so they self-register
 * exactly once.
 */
export default {
  paths: ["features/**/*.feature"],
  import: [
    "features/support/world.ts",
    "features/support/hooks.ts",
    "features/step_definitions/**/*.ts",
  ],
  format: ["progress-bar", "summary"],
  formatOptions: { snippetInterface: "async-await" },
};
