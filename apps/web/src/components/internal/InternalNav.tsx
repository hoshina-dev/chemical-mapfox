"use client";

import { Anchor, Box, Container, Group, Text } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { experimentListingPath } from "@/lib/experiment-manager/routes";

const EXPERIMENTS_HREF = experimentListingPath();

const NAV_ITEMS = [
  { href: EXPERIMENTS_HREF, label: "Experiments" },
  { href: "/internal/experiment/onboarding", label: "Onboarding" },
  { href: "/internal/docs", label: "Docs" },
];

function isActive(pathname: string, href: string): boolean {
  // "Experiments" owns the whole experiment workspace section except
  // onboarding, so the workspace route (/internal/experiment/{id}) highlights
  // it too even though its own href now points at /admin.
  if (href === EXPERIMENTS_HREF) {
    return (
      pathname === EXPERIMENTS_HREF ||
      (pathname.startsWith("/internal/experiment") &&
        !pathname.startsWith("/internal/experiment/onboarding"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function InternalNav() {
  const pathname = usePathname();

  return (
    <Box
      component="header"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
        backgroundColor: "var(--mantine-color-body)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="xl">
        <Group h={56} justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Anchor
              component={Link}
              href="/dashboard"
              underline="never"
              c="dark"
            >
              <Text fw={700} size="sm">
                🧪 ChemFox
              </Text>
            </Anchor>
            <Group gap={4} wrap="nowrap">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Anchor
                    key={item.href}
                    component={Link}
                    href={item.href}
                    underline="never"
                  >
                    <Box
                      px="sm"
                      py={6}
                      style={{
                        borderRadius: "var(--mantine-radius-sm)",
                        fontSize: "var(--mantine-font-size-sm)",
                        fontWeight: 500,
                        lineHeight: 1,
                        color: active
                          ? "var(--mantine-color-blue-filled)"
                          : "var(--mantine-color-dimmed)",
                        backgroundColor: active
                          ? "var(--mantine-color-blue-light)"
                          : "transparent",
                      }}
                    >
                      {item.label}
                    </Box>
                  </Anchor>
                );
              })}
            </Group>
          </Group>
          <Anchor component={Link} href="/dashboard" size="sm" c="dimmed">
            ← Back to app
          </Anchor>
        </Group>
      </Container>
    </Box>
  );
}
