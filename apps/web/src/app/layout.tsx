import "@mantine/core/styles.css";
import "./globals.css";

import { mantineHtmlProps, MantineProvider } from "@mantine/core";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ChemFox",
  description: "Next.js + Mantine application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        {/*
          Dark-mode / color-scheme switching is not enabled yet. When you add a
          theme toggle (`useMantineColorScheme`, or a `defaultColorScheme="auto"`
          on MantineProvider), re-enable Mantine's <ColorSchemeScript /> here so
          the persisted scheme is applied *before* hydration and there's no flash
          of the wrong theme:

            import { ColorSchemeScript } from "@mantine/core";
            ...
            <head>
              <ColorSchemeScript />
            </head>

          It is commented out for now for two reasons:
            1. With no scheme switching it's a no-op (the app is light-only, so
               there's never an alternate scheme to apply before hydration).
            2. On React 19 + Next.js 16.2.x it logs a dev-only console error
               — "Encountered a script tag while rendering React component" —
               because the inline script it injects can't be re-executed during
               client render. This is NOT Mantine-specific: it's a React 19 /
               Next 16.2 behavior that hits every library injecting a
               pre-hydration theme script (next-themes, shadcn/ui, HeroUI,
               Mantine). It surfaced with the Next.js 16.2.x line and is harmless
               in production (the only suggested workaround moves the script into
               a client `useEffect`, which reintroduces the theme flash it exists
               to prevent).
          References (same root cause; no clean upstream fix as of 2026-06):
            - Next 16.2 + React 19 report: https://github.com/heroui-inc/heroui/issues/6348
            - shadcn/ui: https://github.com/shadcn-ui/ui/issues/10200
            - next-themes: https://github.com/pacocoursey/next-themes/issues/387
            - Mantine FAQ: https://help.mantine.dev/q/color-scheme-hydration-warning
        */}
      </head>
      <body>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
}
