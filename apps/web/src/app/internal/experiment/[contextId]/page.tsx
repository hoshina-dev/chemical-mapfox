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

import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { CopyableId } from "@/components/internal/CopyableId";
import { UserAvatar } from "@/components/UserAvatar";
import { ExperimentStateView } from "@/components/internal/ExperimentStateView";
import { FinalizingActions } from "@/components/internal/FinalizingActions";
import { ReportPanel } from "@/components/experiment/ReportPanel";
import { StartExperimentButton } from "@/components/internal/StartExperimentButton";
import { LinkButton } from "@/components/links";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireSession, toSessionUser } from "@/lib/auth/dal";
import {
  experimentCheckinPath,
  experimentListingPath,
  experimentReportDownloadPath,
  experimentReportViewPath,
  experimentRawPath,
} from "@/lib/experiment-manager/routes";
import { getExperimentWorkspace } from "@/lib/internal/experiments";
import { statusMeta } from "@/lib/ticketing/tickets";

export const dynamic = "force-dynamic";

export default async function ExperimentWorkspacePage({
  params,
}: {
  params: Promise<{ contextId: string }>;
}) {
  const { contextId } = await params;
  const session = await requireSession();
  const ws = await getExperimentWorkspace(contextId);
  const { ticket, requester, state } = ws;
  const status = ticket?.status ?? null;
  const meta = ticket ? statusMeta(ticket.status) : null;
  // Editing/collaboration is only allowed once the experiment has started.
  // Earlier stages (REQUESTED, PENDING) and later ones (FINALIZING, CLOSED)
  // render the lab form read-only.
  const canEdit = status === "EXPERIMENTING";

  // FINALIZING-stage gating: report generation depends on calculations having
  // been run, but only when the template defines any. A calculation counts as
  // "run" once its result is populated (`POST /calculate` writes it).
  const calcEntries = state ? Object.entries(state.template.calculations) : [];
  const hasCalculations = calcEntries.length > 0;
  const calculationsReady =
    !hasCalculations ||
    calcEntries.every(
      ([, calc]) =>
        calc.result !== undefined &&
        calc.result !== null &&
        calc.result !== "",
    );
  const reportReady =
    state?.reportStatus?.toLowerCase() === "success" ||
    state?.reportStatus?.toLowerCase() === "succeeded";

  const stages = [
    { label: "Created", at: ticket?.createdAt ?? null },
    { label: "Sample received", at: ticket?.sampleReceivedAt ?? null },
    { label: "Experiment started", at: ticket?.experimentStartedAt ?? null },
    { label: "Results submitted", at: ticket?.resultsSubmittedAt ?? null },
    { label: "Closed", at: ticket?.closedAt ?? null },
  ];
  const reachedCount = stages.filter((s) => s.at).length;

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: "Experiments", href: experimentListingPath() },
            { label: ws.experimentTitle ?? contextId },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" align="center">
              <Title order={2}>
                {ws.experimentTitle ?? "Experiment workspace"}
              </Title>
              {ws.sampleType && (
                <Badge variant="light" color="grape" radius="sm">
                  {ws.sampleType}
                </Badge>
              )}
            </Group>
            <CopyableId value={contextId} href={experimentRawPath(contextId)} />
          </Stack>
          {meta && (
            <Badge color={meta.color} variant="light" size="lg" radius="sm">
              {meta.label}
            </Badge>
          )}
        </Group>

        {ws.errors.ticket && (
          <Alert color="red" variant="light" title="Could not load ticket">
            {ws.errors.ticket}
          </Alert>
        )}

        <Grid gap="lg">
          <GridCol span={{ base: 12, md: 8 }}>
            <Stack gap="lg">
              {status === "REQUESTED" && (
                <Alert
                  color="blue"
                  variant="light"
                  title="Sample not received yet"
                >
                  <Stack gap="sm" align="flex-start">
                    <Text size="sm">
                      This experiment is waiting for its sample to arrive. Check
                      it in once the box reaches the lab to begin.
                    </Text>
                    <LinkButton
                      href={experimentCheckinPath(contextId)}
                      variant="light"
                    >
                      Go to check-in
                    </LinkButton>
                  </Stack>
                </Alert>
              )}

              {status === "PENDING" && (
                <Alert
                  color="blue"
                  variant="light"
                  title="Sample received — ready to start"
                >
                  <Stack gap="sm" align="flex-start">
                    <Text size="sm">
                      The sample is checked in. Start the experiment to enter and
                      collaborate on lab values.
                    </Text>
                    <StartExperimentButton contextId={contextId} />
                  </Stack>
                </Alert>
              )}

              {status === "FINALIZING" && state && (
                <FinalizingActions
                  contextId={contextId}
                  hasCalculations={hasCalculations}
                  calculationsReady={calculationsReady}
                  initialReportStatus={state.reportStatus}
                  reportGeneratedAt={state.reportGeneratedAt}
                />
              )}

              {status === "CLOSED" && reportReady && (
                <ReportPanel
                  generatedAt={state?.reportGeneratedAt ?? null}
                  viewHref={experimentReportViewPath(contextId)}
                  downloadHref={experimentReportDownloadPath(contextId)}
                />
              )}

              {state ? (
                <ExperimentStateView
                  state={state}
                  editable={
                    canEdit
                      ? {
                          contextId,
                          currentUser: toSessionUser(session),
                          canSubmit: true,
                        }
                      : undefined
                  }
                />
              ) : (
                <Alert
                  color="gray"
                  variant="light"
                  title="Current state unavailable"
                >
                  {ws.errors.state ??
                    "No experiment context found for this ID yet. Values appear here once the experiment has been created in Experiment Manager."}
                </Alert>
              )}
            </Stack>
          </GridCol>

          <GridCol span={{ base: 12, md: 4 }}>
            <Stack gap="lg">
              <Card withBorder radius="md" padding="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
                  Requester
                </Text>
                {requester ? (
                  <Group gap="sm" wrap="nowrap">
                    <UserAvatar
                      name={requester.name}
                      email={requester.email}
                      avatarUrl={requester.avatarUrl}
                      radius="xl"
                    />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      {requester.name && (
                        <Text size="sm" fw={500}>
                          {requester.name}
                        </Text>
                      )}
                      <Text size="sm" c="dimmed" truncate>
                        {requester.email ?? requester.id}
                      </Text>
                    </Stack>
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed">
                    {ticket?.userId ?? "Unknown"}
                  </Text>
                )}
              </Card>

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
                  <Detail label="Organization" value={ticket?.organizationId} mono />
                  <Detail label="Template ID" value={ticket?.templateId} mono />
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
