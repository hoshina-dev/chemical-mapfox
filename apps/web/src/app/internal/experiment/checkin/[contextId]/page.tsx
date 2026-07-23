import {
  Alert,
  Badge,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { CheckInButton } from "@/components/internal/CheckInButton";
import { CopyableId } from "@/components/internal/CopyableId";
import { ExperimentStateView } from "@/components/internal/ExperimentStateView";
import { LinkButton } from "@/components/links";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireSession } from "@/lib/auth/dal";
import {
  experimentListingPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import { StatusChip } from "@/components/ticketing/StatusChip";
import { getExperimentWorkspace } from "@/lib/internal/experiments";

export const dynamic = "force-dynamic";

export default async function SampleCheckInPage({
  params,
}: {
  params: Promise<{ contextId: string }>;
}) {
  const { contextId } = await params;
  const t = await getTranslations("staff.checkin");
  const tNav = await getTranslations("staff.nav");
  await requireSession();
  const ws = await getExperimentWorkspace(contextId);
  const { ticket, requester, state } = ws;
  const status = ticket?.status ?? null;
  const isRequested = status === "REQUESTED";
  // PENDING or any later stage means the sample was already checked in.
  const alreadyReceived = status != null && status !== "REQUESTED";

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: tNav("experiments"), href: experimentListingPath() },
            { label: t("breadcrumb") },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" align="center">
              <Title order={2}>{t("title")}</Title>
              {ws.sampleType && (
                <Badge variant="light" color="grape" radius="sm">
                  {ws.sampleType}
                </Badge>
              )}
            </Group>
            <Text c="dimmed">
              {ws.experimentTitle ?? t("experimentFallback")}
            </Text>
            <CopyableId
              value={contextId}
              href={experimentWorkspacePath(contextId)}
            />
          </Stack>
          {status && <StatusChip status={status} variant="badge" size="lg" />}
        </Group>

        {ws.errors.ticket && (
          <Alert color="red" variant="light" title={t("loadTicketErrorTitle")}>
            {ws.errors.ticket}
          </Alert>
        )}

        {!ticket && !ws.errors.ticket && (
          <Alert color="gray" variant="light" title={t("ticketNotFoundTitle")}>
            {t("ticketNotFoundBody")}
          </Alert>
        )}

        {ticket && (
          <Card withBorder radius="md" padding="lg">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
              {t("ticketHeading")}
            </Text>
            <Stack gap="sm">
              <Detail
                label={t("requester")}
                value={requester?.name ?? requester?.email ?? ticket.userId}
              />
              <Detail
                label={t("organization")}
                value={ticket.organizationId}
                mono
              />
              <Detail
                label={t("requested")}
                value={<LocalDateTime iso={ticket.createdAt} />}
              />
            </Stack>
          </Card>
        )}

        {isRequested && (
          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <div>
                <Title order={4}>{t("checkInHeading")}</Title>
                <Text size="sm" c="dimmed">
                  {t("checkInBody")}
                </Text>
              </div>
              <CheckInButton contextId={contextId} />
            </Stack>
          </Card>
        )}

        {alreadyReceived && (
          <Alert color="teal" variant="light" title={t("alreadyTitle")}>
            <Stack gap="sm" align="flex-start">
              <Text size="sm">
                {ticket?.sampleReceivedAt
                  ? t.rich("alreadyBodyWithDate", {
                      date: () => (
                        <LocalDateTime iso={ticket.sampleReceivedAt} />
                      ),
                    })
                  : t("alreadyBody")}
              </Text>
              <LinkButton
                href={experimentWorkspacePath(contextId)}
                variant="light"
              >
                {t("openWorkspace")}
              </LinkButton>
            </Stack>
          </Alert>
        )}

        {state && (
          <Stack gap="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {t("experimentDetail")}
            </Text>
            <ExperimentStateView state={state} />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ff={mono ? "monospace" : undefined}>
        {value ?? "—"}
      </Text>
    </Stack>
  );
}
