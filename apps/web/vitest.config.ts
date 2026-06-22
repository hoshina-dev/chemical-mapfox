import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `server-only` throws when bundled for the client; in tests we stub it out so
// server modules (lib/collab/room.ts, …) can be imported under Node.
const serverOnlyStub = fileURLToPath(
  new URL("./test/server-only-stub.ts", import.meta.url),
);
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  // Resolve `@/*` via an explicit alias (not the tsconfig-paths plugin) so that
  // vitest's vi.mock resolver matches the same ids the app imports.
  resolve: {
    alias: [
      { find: "server-only", replacement: serverOnlyStub },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "browser",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./test/browser-setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
