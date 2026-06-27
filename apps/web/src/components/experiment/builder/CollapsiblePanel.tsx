"use client";

import { Badge, Collapse, Group, Paper, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible section wrapper for the template builder. `width: "100%"` is
 * pinned explicitly on both the Paper and the Collapse content — Mantine's
 * Stack normally stretches children to full width, but when every section is
 * collapsed at once the resulting near-zero content height has, in practice,
 * let some ancestor recompute a narrower width. Pinning it here removes the
 * possibility regardless of which ancestor causes it.
 */
export function CollapsiblePanel({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Paper withBorder radius="md" style={{ width: "100%", overflow: "hidden" }}>
      <UnstyledButton
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "block",
          background: open ? "var(--mantine-color-body)" : "var(--mantine-color-gray-0)",
          transition: "background 0.15s",
        }}
      >
        <Group justify="space-between" wrap="nowrap" p="md" gap="sm">
          <Title order={3} style={{ flex: 1 }}>
            {title}
          </Title>
          {badge && (
            <Badge variant="light" color="gray" radius="sm">
              {badge}
            </Badge>
          )}
          <Text
            size="xs"
            fw={600}
            c="dimmed"
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-xl)",
              padding: "3px 10px",
            }}
          >
            {open ? "Collapse ↑" : "Expand ↓"}
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse expanded={open} style={{ width: "100%" }}>
        <Stack gap="sm" px="md" pb="md" style={{ width: "100%" }}>
          {subtitle && (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
          {children}
        </Stack>
      </Collapse>
    </Paper>
  );
}
