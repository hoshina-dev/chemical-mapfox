"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("experiment.report");
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4}>{t("title")}</Title>
          <Text size="sm" c="dimmed">
            {generatedAt ? (
              <>
                {t.rich("generated", {
                  date: () => <LocalDateTime iso={generatedAt} />,
                })}{" "}
              </>
            ) : null}
            {t("body")}
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
            {t("view")}
          </Button>
          <Button
            component="a"
            href={downloadHref}
            variant="light"
            size="sm"
            download
          >
            {t("download")}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
