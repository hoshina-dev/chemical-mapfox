"use client";

import { Anchor, Box, Container, Group, Text } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  myExperimentsPath,
  requestCatalogPath,
} from "@/lib/experiment/routes";

const NAV_ITEMS = [
  { href: myExperimentsPath(), label: "My experiments" },
  { href: requestCatalogPath(), label: "Request experiment" },
];

function isActive(pathname: string, href: string): boolean {
  // "My experiments" owns the listing + detail routes; "Request" owns the
  // request catalogue + onboarding routes.
  if (href === myExperimentsPath()) {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && !pathname.startsWith(requestCatalogPath()))
    );
  }
  return pathname.startsWith("/experiment/request");
}

export function ClientNav() {
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
