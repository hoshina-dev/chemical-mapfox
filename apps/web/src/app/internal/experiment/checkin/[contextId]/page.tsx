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
import { getExperimentWorkspace } from "@/lib/internal/experiments";
import { statusMeta } from "@/lib/ticketing/tickets";

export const dynamic = "force-dynamic";

export default async function SampleCheckInPage({
  params,
}: {
  params: Promise<{ contextId: string }>;
}) {
  const { contextId } = await params;
  await requireSession();
  const ws = await getExperimentWorkspace(contextId);
  const { ticket, requester, state } = ws;
  const status = ticket?.status ?? null;
  const meta = status ? statusMeta(status) : null;
  const isRequested = status === "REQUESTED";
  // PENDING or any later stage means the sample was already checked in.
  const alreadyReceived = status != null && status !== "REQUESTED";

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: "Experiments", href: experimentListingPath() },
            { label: "Sample check-in" },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" align="center">
              <Title order={2}>Sample check-in</Title>
              {ws.sampleType && (
                <Badge variant="light" color="grape" radius="sm">
                  {ws.sampleType}
                </Badge>
              )}
            </Group>
            <Text c="dimmed">{ws.experimentTitle ?? "Experiment"}</Text>
            <CopyableId value={contextId} href={experimentWorkspacePath(contextId)} />
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

        {!ticket && !ws.errors.ticket && (
          <Alert color="gray" variant="light" title="Ticket not found">
            No experiment ticket exists for this context id.
          </Alert>
        )}

        {ticket && (
          <Card withBorder radius="md" padding="lg">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
              Ticket
            </Text>
            <Stack gap="sm">
              <Detail
                label="Requester"
                value={requester?.name ?? requester?.email ?? ticket.userId}
              />
              <Detail label="Organization" value={ticket.organizationId} mono />
              <Detail
                label="Requested"
                value={<LocalDateTime iso={ticket.createdAt} />}
              />
            </Stack>
          </Card>
        )}

        {isRequested && (
          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <div>
                <Title order={4}>Check in this sample</Title>
                <Text size="sm" c="dimmed">
                  Confirm the sample box has arrived at the lab. This moves the
                  ticket to &ldquo;Sample received&rdquo;, ready for an
                  experiment to be started in the workspace.
                </Text>
              </div>
              <CheckInButton contextId={contextId} />
            </Stack>
          </Card>
        )}

        {alreadyReceived && (
          <Alert color="teal" variant="light" title="Already checked in">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">
                This sample was already received
                {ticket?.sampleReceivedAt && (
                  <>
                    {" on "}
                    <LocalDateTime iso={ticket.sampleReceivedAt} />
                  </>
                )}
                . Continue in the experiment workspace.
              </Text>
              <LinkButton
                href={experimentWorkspacePath(contextId)}
                variant="light"
              >
                Open workspace
              </LinkButton>
            </Stack>
          </Alert>
        )}

        {state && (
          <Stack gap="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Experiment detail
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
