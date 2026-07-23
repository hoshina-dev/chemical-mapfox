import { MantineProvider } from "@mantine/core";
import { render as rtlRender } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import messages from "../messages/en.json";

/**
 * RTL render wrapped in a MantineProvider (required for Mantine components)
 * and a NextIntlClientProvider (required for components using `useTranslations`).
 */
export function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <MantineProvider>{children}</MantineProvider>
      </NextIntlClientProvider>
    ),
  });
}

export * from "@testing-library/react";
