import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL doesn't auto-clean without test globals, so unmount between tests to keep
// each test's DOM isolated.
afterEach(() => {
  cleanup();
});
