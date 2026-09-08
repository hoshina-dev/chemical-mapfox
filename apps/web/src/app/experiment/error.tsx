"use client";

import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";

/**
 * Route-level backstop for /experiment/*. Panel failures are caught by
 * `AsyncPanel` and never reach here; this catches anything thrown by the page
 * shell itself, so a route can never render blank.
 */
export default function ExperimentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.asyncPanel");

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <Alert color="red" variant="light" title={t("title")}>
        <Stack gap="sm">
          <Text size="sm">{t("body")}</Text>
          <Group>
            <Button size="xs" variant="default" onClick={reset}>
              {t("retry")}
            </Button>
          </Group>
        </Stack>
      </Alert>
    </div>
  );
}
