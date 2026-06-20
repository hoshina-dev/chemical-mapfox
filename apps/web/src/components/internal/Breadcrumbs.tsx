"use client";

import { Anchor, Breadcrumbs as MantineBreadcrumbs, Text } from "@mantine/core";
import Link from "next/link";

export interface Crumb {
  label: string;
  /** Omit on the current (last) crumb to render it as plain text. */
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <MantineBreadcrumbs
      separator="/"
      separatorMargin="xs"
      styles={{ separator: { color: "var(--mantine-color-dimmed)" } }}
    >
      {items.map((item) =>
        item.href ? (
          <Anchor key={item.label} component={Link} href={item.href} size="sm" c="dimmed">
            {item.label}
          </Anchor>
        ) : (
          <Text key={item.label} size="sm" c="dimmed" fw={500}>
            {item.label}
          </Text>
        ),
      )}
    </MantineBreadcrumbs>
  );
}
