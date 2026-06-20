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

import { ExperimentStateView } from "@/components/internal/ExperimentStateView";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { CopyableId } from "@/components/internal/CopyableId";
import { requireSession } from "@/lib/auth/dal";
import { myExperimentsPath } from "@/lib/experiment/routes";
import { getExperimentWorkspace } from "@/lib/internal/experiments";
import { formatDateTime, statusMeta } from "@/lib/ticketing/tickets";

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
              <Card withBorder radius="md" padding="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="md">
                  Lifecycle
                </Text>
                <Timeline active={reachedCount - 1} bulletSize={16} lineWidth={2}>
                  {stages.map((stage) => (
                    <TimelineItem key={stage.label} title={stage.label}>
                      <Text size="xs" c="dimmed">
                        {formatDateTime(stage.at)}
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
                      value={formatDateTime(state.reportGeneratedAt)}
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
  value: string | null | undefined;
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
