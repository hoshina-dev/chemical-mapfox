import { MantineProvider } from "@mantine/core";
import { render as rtlRender } from "@testing-library/react";
import type { ReactElement } from "react";

/** RTL render wrapped in a MantineProvider (required for Mantine components). */
export function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MantineProvider>{children}</MantineProvider>,
  });
}

export * from "@testing-library/react";
