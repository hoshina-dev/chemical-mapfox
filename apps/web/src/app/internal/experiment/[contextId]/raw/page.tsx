import { Alert, Card, Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { RawJsonView } from "@/components/internal/RawJsonView";
import {
  ExperimentManagerError,
  getExperiment,
} from "@/lib/experiment-manager/client";
import {
  experimentListingPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import { ticketsApi } from "@/lib/ticketing/client";

export const dynamic = "force-dynamic";

interface FetchError {
  status: number | null;
  body: unknown;
  message: string;
}

export default async function ExperimentRawPage({
  params,
}: {
  params: Promise<{ contextId: string }>;
}) {
  const { contextId } = await params;
  const t = await getTranslations("staff.raw");
  const tNav = await getTranslations("staff.nav");

  let ticket: unknown;
  let ticketError: FetchError | null = null;
  try {
    ticket = await ticketsApi.apiV1TicketsIdGet(contextId);
  } catch (error) {
    ticketError = {
      status: null,
      body: undefined,
      message: error instanceof Error ? error.message : t("ticketErrorFallback"),
    };
  }

  let experiment: unknown;
  let experimentError: FetchError | null = null;
  try {
    experiment = await getExperiment(contextId);
  } catch (error) {
    if (error instanceof ExperimentManagerError) {
      experimentError = {
        status: error.status,
        body: error.body,
        message: error.message,
      };
    } else {
      experimentError = {
        status: null,
        body: undefined,
        message:
          error instanceof Error ? error.message : t("experimentErrorFallback"),
      };
    }
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: tNav("experiments"), href: experimentListingPath() },
            { label: contextId, href: experimentWorkspacePath(contextId) },
            { label: t("breadcrumb") },
          ]}
        />

        <Stack gap={4}>
          <Title order={2}>{t("title")}</Title>
          <Text size="sm" c="dimmed" ff="monospace">
            {contextId}
          </Text>
        </Stack>

        <Card withBorder radius="md" padding="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
            {t("ticketHeading")}
          </Text>
          {ticketError ? (
            <Alert color="orange" variant="light" title={t("ticketErrorTitle")}>
              {ticketError.message}
            </Alert>
          ) : (
            <RawJsonView data={ticket} />
          )}
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
            {t("experimentHeading")}
          </Text>
          {experimentError ? (
            <Stack gap="sm">
              <Alert
                color="orange"
                variant="light"
                title={
                  experimentError.status
                    ? t("experimentReturned", { status: experimentError.status })
                    : t("experimentErrorTitle")
                }
              >
                {experimentError.status === 404
                  ? t("experimentNotFound")
                  : experimentError.message}
              </Alert>
              {experimentError.body !== undefined && (
                <RawJsonView data={experimentError.body} />
              )}
            </Stack>
          ) : (
            <RawJsonView data={experiment} />
          )}
        </Card>
      </Stack>
    </Container>
  );
}
