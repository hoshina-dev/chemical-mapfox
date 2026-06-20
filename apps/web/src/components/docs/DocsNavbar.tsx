"use client";

import { Anchor, Container, Group, Text } from "@mantine/core";
import Link from "next/link";

export function DocsNavbar() {
  return (
    <Container
      size="xl"
      py="sm"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <Group justify="space-between">
        <Anchor component={Link} href="/internal/docs" c="dark" underline="never">
          <Text fw={700}>Hoshina Docs</Text>
        </Anchor>
        <Anchor component={Link} href="/dashboard" size="sm" c="dimmed">
          ← Back to app
        </Anchor>
      </Group>
    </Container>
  );
}
