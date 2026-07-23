import {
  Alert,
  Badge,
  Card,
  Container,
  Grid,
  GridCol,
  Group,
  Stack,
  Text,
  Timeline,
  TimelineItem,
  Title,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ExperimentStateView } from "@/components/internal/ExperimentStateView";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { CopyableId } from "@/components/internal/CopyableId";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ReportPanel } from "@/components/experiment/ReportPanel";
import { SampleLabel } from "@/components/experiment/SampleLabel";
import { requireSession } from "@/lib/auth/dal";
import { experimentCheckinPath } from "@/lib/experiment-manager/routes";
import {
  myExperimentReportDownloadPath,
  myExperimentReportViewPath,
  myExperimentsPath,
} from "@/lib/experiment/routes";
import { StatusChip } from "@/components/ticketing/StatusChip";
import { getRequestOrigin } from "@/lib/http/origin";
import { getExperimentWorkspace } from "@/lib/internal/experiments";

export const dynamic = "force-dynamic";

export default async function MyExperimentDetailPage({
  params,
}: {
  params: Promise<{ contextId: string }>;
}) {
  const { contextId } = await params;
  const session = await requireSession();
  const ws = await getExperimentWorkspace(contextId);
  const { ticket, state } = ws;
  const t = await getTranslations("experiment.detail");
  const tCommon = await getTranslations("common");

  // Ownership: a client may only view their own experiment. Fail closed —
  // if the ticket did not load, has no owner, or belongs to someone else,
  // hide it entirely (matches the pattern in lib/experiment-manager/report-route.ts).
  if (!ticket || !ticket.userId || ticket.userId !== session.userId) {
    notFound();
  }

  const showSampleLabel = ticket?.status === "REQUESTED";
  const checkinUrl = showSampleLabel
    ? `${await getRequestOrigin()}${experimentCheckinPath(contextId)}`
    : null;

  const titleFallback = t("titleFallback");
  const stages = [
    { label: t("stages.created"), at: ticket?.createdAt ?? null },
    { label: t("stages.sampleReceived"), at: ticket?.sampleReceivedAt ?? null },
    { label: t("stages.experimentStarted"), at: ticket?.experimentStartedAt ?? null },
    { label: t("stages.resultsSubmitted"), at: ticket?.resultsSubmittedAt ?? null },
    { label: t("stages.closed"), at: ticket?.closedAt ?? null },
  ];
  const reachedCount = stages.filter((s) => s.at).length;
  const reportReady =
    state?.reportStatus?.toLowerCase() === "success" ||
    state?.reportStatus?.toLowerCase() === "succeeded";

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: t("breadcrumbMyExperiments"), href: myExperimentsPath() },
            { label: ws.experimentTitle ?? contextId },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" align="center">
              <Title order={2}>{ws.experimentTitle ?? titleFallback}</Title>
              {ws.sampleType && (
                <Badge variant="light" color="grape" radius="sm">
                  {ws.sampleType}
                </Badge>
              )}
            </Group>
            <CopyableId value={contextId} />
          </Stack>
          {ticket && (
            <StatusChip status={ticket.status} variant="badge" size="lg" />
          )}
        </Group>

        {ws.errors.ticket && (
          <Alert color="yellow" variant="light" title={t("someDetailsUnavailableTitle")}>
            {ws.errors.ticket}
          </Alert>
        )}

        {checkinUrl && (
          <SampleLabel
            url={checkinUrl}
            title={ws.experimentTitle ?? titleFallback}
            contextId={contextId}
          />
        )}

        <Grid gap="lg">
          <GridCol span={{ base: 12, md: 8 }}>
            {state ? (
              <ExperimentStateView state={state} />
            ) : (
              <Alert color="gray" variant="light" title={t("noDetailsTitle")}>
                {ws.errors.state ?? t("noDetailsBody")}
              </Alert>
            )}
          </GridCol>

          <GridCol span={{ base: 12, md: 4 }}>
            <Stack gap="lg">
              {reportReady && (
                <ReportPanel
                  generatedAt={state?.reportGeneratedAt ?? null}
                  viewHref={myExperimentReportViewPath(contextId)}
                  downloadHref={myExperimentReportDownloadPath(contextId)}
                />
              )}

              <Card withBorder radius="md" padding="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="md">
                  {t("lifecycle")}
                </Text>
                <Timeline active={reachedCount - 1} bulletSize={16} lineWidth={2}>
                  {stages.map((stage) => (
                    <TimelineItem key={stage.label} title={stage.label}>
                      <Text size="xs" c="dimmed">
                        <LocalDateTime iso={stage.at} />
                      </Text>
                    </TimelineItem>
                  ))}
                </Timeline>
                {ticket?.closedReason && (
                  <Text size="sm" c="dimmed" mt="md">
                    {t("closedReason", { reason: ticket.closedReason })}
                  </Text>
                )}
              </Card>

              <Card withBorder radius="md" padding="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
                  {t("details")}
                </Text>
                <Stack gap="sm">
                  <Detail
                    label={t("reportStatus")}
                    value={state?.reportStatus ?? tCommon("notGenerated")}
                    dash={tCommon("emDash")}
                  />
                  {state?.reportGeneratedAt && (
                    <Detail
                      label={t("reportGenerated")}
                      value={<LocalDateTime iso={state.reportGeneratedAt} />}
                      dash={tCommon("emDash")}
                    />
                  )}
                </Stack>
              </Card>
            </Stack>
          </GridCol>
        </Grid>
      </Stack>
    </Container>
  );
}

function Detail({
  label,
  value,
  dash,
}: {
  label: string;
  value: ReactNode;
  dash: string;
}) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value ?? dash}</Text>
    </Stack>
  );
}
