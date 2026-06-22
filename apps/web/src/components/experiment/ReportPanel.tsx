"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";

import { LocalDateTime } from "@/components/LocalDateTime";

export function ReportPanel({
  generatedAt,
  viewHref,
  downloadHref,
}: {
  generatedAt: string | null;
  viewHref: string;
  downloadHref: string;
}) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4}>Report</Title>
          <Text size="sm" c="dimmed">
            {generatedAt ? (
              <>
                Generated <LocalDateTime iso={generatedAt} />.{" "}
              </>
            ) : null}
            View the PDF in your browser or download a copy.
          </Text>
        </Stack>
        <Group gap="sm">
          <Button
            component="a"
            href={viewHref}
            target="_blank"
            rel="noreferrer"
            size="sm"
          >
            View report
          </Button>
          <Button
            component="a"
            href={downloadHref}
            variant="light"
            size="sm"
            download
          >
            Download PDF
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
