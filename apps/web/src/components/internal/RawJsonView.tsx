"use client";

import { Box, Button, CopyButton, Text } from "@mantine/core";

/** Pretty-printed, scrollable JSON with a copy-to-clipboard button. */
export function RawJsonView({ data }: { data: unknown }) {
  if (data === undefined) {
    return (
      <Text size="sm" c="dimmed">
        No data
      </Text>
    );
  }

  const json = JSON.stringify(data, null, 2);

  return (
    <Box style={{ position: "relative" }}>
      <Box style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
        <CopyButton value={json} timeout={1500}>
          {({ copied, copy }) => (
            <Button
              size="compact-xs"
              variant="default"
              color={copied ? "teal" : "gray"}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          )}
        </CopyButton>
      </Box>
      <pre
        style={{
          margin: 0,
          padding: "var(--mantine-spacing-md)",
          paddingTop: "calc(var(--mantine-spacing-md) + 1.5rem)",
          border: "1px solid var(--mantine-color-default-border)",
          borderRadius: "var(--mantine-radius-md)",
          backgroundColor: "var(--mantine-color-default)",
          fontFamily: "var(--mantine-font-family-monospace)",
          fontSize: "var(--mantine-font-size-xs)",
          lineHeight: 1.55,
          overflowX: "auto",
          whiteSpace: "pre",
        }}
      >
        {json}
      </pre>
    </Box>
  );
}
