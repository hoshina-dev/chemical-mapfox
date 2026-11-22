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
  Tooltip,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";

import type { ReactNode } from "react";

import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { CopyableId } from "@/components/internal/CopyableId";
import { UserAvatar } from "@/components/UserAvatar";
import { ExperimentStateView } from "@/components/internal/ExperimentStateView";
import { ReportPanel } from "@/components/experiment/ReportPanel";
import { ReopenExperimentButton } from "@/components/internal/ReopenExperimentButton";
import { StartExperimentButton } from "@/components/internal/StartExperimentButton";
import { TicketActions } from "@/components/internal/TicketActions";
import { LinkButton } from "@/components/links";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireAdmin, toSessionUser } from "@/lib/auth/dal";
import {
  experimentCheckinPath,
  experimentListingPath,
  experimentReportDownloadPath,
  experimentReportPreviewPath,
  experimentReportViewPath,
  experimentRawPath,
} from "@/lib/internal/routes";
import { StatusChip } from "@/components/status/StatusChip";
import { getExperimentWorkspace } from "@/lib/internal/experiments";
import { collabRoomId } from "@/lib/experiment-manager/mappers";

export const dynamic = "force-dynamic";

/** Method switcher colours by experiment status. */
const METHOD_COLOR: Record<string, string> = {
  PENDING: "gray",
  IN_PROGRESS: "yellow",
  FINISHED: "green",
};

/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting the workspace here would keep the nav and
 * chrome off screen while a backend stalls. The awaits live in the child
 * below, under `AsyncPanel`.
 */
export default function ExperimentWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ contextId: string }>;
  searchParams: Promise<{ experiment?: string }>;
}) {
  return (
    <Container size="xl" py="xl">
      <AsyncPanel fallback={<PanelSkeleton lines={10} />}>
        <ExperimentWorkspaceContent params={params} searchParams={searchParams} />
      </AsyncPanel>
    </Container>
  );
}

async function ExperimentWorkspaceContent({
  params,
  searchParams,
}: {
  params: Promise<{ contextId: string }>;
  searchParams: Promise<{ experiment?: string }>;
}) {
  const { contextId } = await params;
  const { experiment } = await searchParams;
  const t = await getTranslations("staff.workspace");
  const tCommon = await getTranslations("common");
  const session = await requireAdmin();
  const ws = await getExperimentWorkspace(contextId, experiment);
  const { ticket, requester, state, selected } = ws;
  const status = ticket?.status ?? null;
  const ticketOpen = status !== null && !["REQUESTED", "CLOSED", "CANCELLED"].includes(status);
  // The lab form is editable while its experiment is in progress; otherwise read-only.
  const canEdit = ticketOpen && selected?.status === "IN_PROGRESS";
  const reportReady =
    state?.reportStatus?.toLowerCase() === "success" ||
    state?.reportStatus?.toLowerCase() === "succeeded";

  const stages = [
    { label: t("stages.created"), at: ticket?.createdAt ?? null },
    { label: t("stages.sampleReceived"), at: ticket?.sampleReceivedAt ?? null },
    {
      label: t("stages.experimentStarted"),
      at: ticket?.experimentStartedAt ?? null,
    },
    {
      label: t("stages.resultsSubmitted"),
      at: ticket?.resultsSubmittedAt ?? null,
    },
    { label: t("stages.closed"), at: ticket?.closedAt ?? null },
  ];
  const reachedCount = stages.filter((s) => s.at).length;

  return (
    <>
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: t("breadcrumbExperiments"), href: experimentListingPath() },
            { label: ws.experimentTitle ?? contextId },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" align="center">
              <Title order={2}>{ws.experimentTitle ?? t("title")}</Title>
              {ws.sampleType && (
                <Badge variant="light" color="grape" radius="sm">
                  {ws.sampleType}
                </Badge>
              )}
            </Group>
            <CopyableId value={contextId} href={experimentRawPath(contextId)} />
          </Stack>
          {ticket && (
            <StatusChip status={ticket.status} variant="badge" size="lg" />
          )}
        </Group>

        {ws.errors.ticket && (
          <Alert color="red" variant="light" title={t("loadTicketErrorTitle")}>
            {ws.errors.ticket}
          </Alert>
        )}

        <Grid gap="lg">
          <GridCol span={{ base: 12, md: 8 }}>
            <Stack gap="lg">
              {status === "REQUESTED" && (
                <Alert color="blue" variant="light" title={t("requestedTitle")}>
                  <Stack gap="sm" align="flex-start">
                    <Text size="sm">{t("requestedBody")}</Text>
                    <LinkButton
                      href={experimentCheckinPath(contextId)}
                      variant="light"
                    >
                      {t("goToCheckin")}
                    </LinkButton>
                  </Stack>
                </Alert>
              )}

              {ws.experiments.length > 1 && (
                <Group gap="xs">
                  {ws.experiments.map((exp) => (
                    // Colour = the method's phase (hover for its name); filled = the one shown.
                    <Tooltip key={exp.id} label={t(`methodStatus.${exp.status}`)} withArrow>
                      <LinkButton
                        href={`?experiment=${exp.id}`}
                        color={METHOD_COLOR[exp.status] ?? "gray"}
                        variant={exp.id === selected?.id ? "filled" : "light"}
                        size="xs"
                      >
                        {exp.name}
                      </LinkButton>
                    </Tooltip>
                  ))}
                </Group>
              )}

              {selected && ticketOpen && selected.status === "PENDING" && (
                <Alert color="blue" variant="light" title={t("pendingTitle")}>
                  <Stack gap="sm" align="flex-start">
                    <Text size="sm">{t("pendingBody")}</Text>
                    <StartExperimentButton contextId={contextId} experimentId={selected.id} />
                  </Stack>
                </Alert>
              )}

              {selected && ticketOpen && selected.status === "FINISHED" && (
                <Alert color="teal" variant="light" title={t("finishedTitle")}>
                  <Stack gap="sm" align="flex-start">
                    <Text size="sm">{t("finishedBody")}</Text>
                    <ReopenExperimentButton contextId={contextId} experimentId={selected.id} />
                  </Stack>
                </Alert>
              )}

              {reportReady && (
                <ReportPanel
                  generatedAt={state?.reportGeneratedAt ?? null}
                  viewHref={experimentReportViewPath(contextId)}
                  downloadHref={experimentReportDownloadPath(contextId)}
                />
              )}

              {state && selected ? (
                <ExperimentStateView
                  key={selected.id}
                  state={state}
                  editable={
                    canEdit
                      ? {
                          contextId: collabRoomId(contextId, selected.id),
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
                  title={t("stateUnavailableTitle")}
                >
                  {ws.errors.state ?? t("stateUnavailableBody")}
                </Alert>
              )}
            </Stack>
          </GridCol>

          <GridCol span={{ base: 12, md: 4 }}>
            <Stack gap="lg">
              {status && (
                <TicketActions
                  contextId={contextId}
                  status={status}
                  published={Boolean(ws.raw?.reportPublishedAt)}
                  previewHref={experimentReportPreviewPath(contextId)}
                />
              )}

              <Card withBorder radius="md" padding="lg">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="sm">
                  {t("requester")}
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
                    {ticket?.userId ?? t("unknownRequester")}
                  </Text>
                )}
              </Card>

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
                    label={t("organization")}
                    value={ticket?.organizationId}
                    mono
                  />
                  <Detail
                    label={t("templateId")}
                    value={selected?.state.templateId}
                    mono
                  />
                  <Detail
                    label={t("reportStatus")}
                    value={state?.reportStatus ?? tCommon("notGenerated")}
                  />
                  {state?.reportGeneratedAt && (
                    <Detail
                      label={t("reportGenerated")}
                      value={<LocalDateTime iso={state.reportGeneratedAt} />}
                    />
                  )}
                </Stack>
              </Card>
            </Stack>
          </GridCol>
        </Grid>
      </Stack>
    </>
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
