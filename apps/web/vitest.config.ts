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
    coverage: {
      provider: "v8",
      // Scope coverage to modules exercised by unit/browser tests. Pages, server
      // actions, API routes, and UI shells are covered by Cucumber acceptance
      // tests under e2e/features/.
      include: [
        "src/lib/userInitials.ts",
        "src/lib/avatarColors.ts",
        "src/lib/auth/definitions.ts",
        "src/lib/organizationPortal/config.ts",
        "src/lib/organizationPortal/url.ts",
        "src/lib/collab/colors.ts",
        "src/lib/collab/events.ts",
        "src/lib/collab/room.ts",
        "src/lib/experiment-manager/mappers.ts",
        "src/components/UserMenu.tsx",
        "src/components/internal/collab/CollaborativeFormRenderer.tsx",
        "src/components/internal/collab/PresenceBar.tsx",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
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
