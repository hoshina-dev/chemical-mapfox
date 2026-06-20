"use client";

import {
  ActionIcon,
  Anchor,
  CopyButton,
  Group,
  Text,
  Tooltip,
} from "@mantine/core";
import Link from "next/link";

/**
 * A monospace id with a copy button. `stopPropagation` keeps a click on the
 * button from triggering an enclosing clickable row. When `href` is provided
 * the id itself becomes a link.
 */
export function CopyableId({
  value,
  size = "sm",
  href,
}: {
  value: string;
  size?: "xs" | "sm";
  href?: string;
}) {
  return (
    <Group gap={6} wrap="nowrap">
      {href ? (
        <Anchor
          component={Link}
          href={href}
          size={size}
          ff="monospace"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </Anchor>
      ) : (
        <Text size={size} ff="monospace">
          {value}
        </Text>
      )}
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color={copied ? "teal" : "gray"}
              aria-label="Copy context ID"
              onClick={(e) => {
                e.stopPropagation();
                copy();
              }}
            >
              <Text size="xs" aria-hidden>
                {copied ? "✓" : "⧉"}
              </Text>
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}
