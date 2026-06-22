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
import { getRequestOrigin } from "@/lib/http/origin";
import { getExperimentWorkspace } from "@/lib/internal/experiments";
import { statusMeta } from "@/lib/ticketing/tickets";

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

  // Ownership: a client may only view their own experiment. If the ticket
  // loaded and belongs to someone else, hide it entirely.
  if (ticket && ticket.userId && ticket.userId !== session.userId) {
    notFound();
  }

  const meta = ticket ? statusMeta(ticket.status) : null;

  // While the request is still awaiting its sample, offer a printable QR label
  // the requester attaches to the shipping box; lab staff scan it to check in.
  const showSampleLabel = ticket?.status === "REQUESTED";
  const checkinUrl = showSampleLabel
    ? `${await getRequestOrigin()}${experimentCheckinPath(contextId)}`
    : null;

  const stages = [
    { label: "Created", at: ticket?.createdAt ?? null },
    { label: "Sample received", at: ticket?.sampleReceivedAt ?? null },
    { label: "Experiment started", at: ticket?.experimentStartedAt ?? null },
    { label: "Results submitted", at: ticket?.resultsSubmittedAt ?? null },
    { label: "Closed", at: ticket?.closedAt ?? null },
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
            { label: "Dashboard", href: "/dashboard" },
            { label: "My experiments", href: myExperimentsPath() },
            { label: ws.experimentTitle ?? contextId },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" align="center">
              <Title order={2}>{ws.experimentTitle ?? "Experiment"}</Title>
              {ws.sampleType && (
                <Badge variant="light" color="grape" radius="sm">
                  {ws.sampleType}
                </Badge>
              )}
            </Group>
            <CopyableId value={contextId} />
          </Stack>
          {meta && (
            <Badge color={meta.color} variant="light" size="lg" radius="sm">
              {meta.label}
            </Badge>
          )}
        </Group>

        {ws.errors.ticket && (
          <Alert color="yellow" variant="light" title="Some details unavailable">
            {ws.errors.ticket}
          </Alert>
        )}

        {checkinUrl && (
          <SampleLabel
            url={checkinUrl}
            title={ws.experimentTitle ?? "Experiment"}
            contextId={contextId}
          />
        )}

        <Grid gap="lg">
          <GridCol span={{ base: 12, md: 8 }}>
            {state ? (
              <ExperimentStateView state={state} />
            ) : (
              <Alert color="gray" variant="light" title="No details yet">
                {ws.errors.state ??
                  "No details available yet. Your entries and results appear here once the lab begins work on this experiment."}
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
                  Lifecycle
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
                    Closed reason: {ticket.closedReason}
                  </Text>
                )}
              </Card>

              <Card withBorder radius="md" padding="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
                  Details
                </Text>
                <Stack gap="sm">
                  <Detail
                    label="Report status"
                    value={state?.reportStatus ?? "Not generated"}
                  />
                  {state?.reportGeneratedAt && (
                    <Detail
                      label="Report generated"
                      value={<LocalDateTime iso={state.reportGeneratedAt} />}
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
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value ?? "—"}</Text>
    </Stack>
  );
}
