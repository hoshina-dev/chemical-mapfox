"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  calculateExperimentAction,
  closeTicketAction,
  generateReportAction,
  getReportStatusAction,
} from "@/app/actions/experiment";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  experimentReportDownloadPath,
  experimentReportViewPath,
} from "@/lib/experiment-manager/routes";

/** While in one of these the report worker is still running — poll, don't act. */
function isInFlight(status: string | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "pending" || normalized === "processing";
}

function normalizeStatus(status: string | null): string | null {
  return status?.toLowerCase() ?? null;
}

function isReady(status: string | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "success" || normalized === "succeeded";
}

function isFailed(status: string | null): boolean {
  return normalizeStatus(status) === "failed";
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Queued", color: "blue" },
  processing: { label: "Generating…", color: "blue" },
  success: { label: "Ready", color: "teal" },
  succeeded: { label: "Ready", color: "teal" },
  failed: { label: "Failed", color: "red" },
};

function statusMeta(status: string | null) {
  const normalized = normalizeStatus(status);
  if (!normalized) return { label: "Not generated", color: "gray" };
  return STATUS_META[normalized] ?? { label: status ?? normalized, color: "gray" };
}

const POLL_INTERVAL_MS = 3000;

export interface FinalizingActionsProps {
  contextId: string;
  /** The template defines calculations, so a Calculate step is offered. */
  hasCalculations: boolean;
  /** Every calculation already has a result (or there are none to run). */
  calculationsReady: boolean;
  initialReportStatus: string | null;
  reportGeneratedAt: string | null;
}

/**
 * Lab-staff actions for the FINALIZING stage: run calculations, then generate
 * the PDF report. The two are independent actions, but report generation is
 * gated on calculations having run (when the template has any). Both are
 * re-runnable. Generation is async, so we poll the report status only while a
 * job is actually in flight and surface view/download actions once it succeeds.
 */
export function FinalizingActions({
  contextId,
  hasCalculations,
  calculationsReady,
  initialReportStatus,
  reportGeneratedAt,
}: FinalizingActionsProps) {
  const router = useRouter();

  const [calcPending, startCalc] = useTransition();
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcDoneThisSession, setCalcDoneThisSession] = useState(false);

  const [reportStatus, setReportStatus] = useState(initialReportStatus);
  const [genPending, startGen] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const [closePending, startClose] = useTransition();
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const inFlight = isInFlight(reportStatus);
  // Report generation depends on calculations: allowed once they've been run
  // (or the template has none). `calcDoneThisSession` reflects a calculate that
  // just succeeded before the server-rendered `calculationsReady` catches up.
  const calcSatisfied =
    !hasCalculations || calculationsReady || calcDoneThisSession;
  const reportIsReady = isReady(reportStatus);
  const canClose = calcSatisfied && reportIsReady && !inFlight;
  const meta = statusMeta(reportStatus);

  // Poll for completion while a report job is in flight. A self-rescheduling
  // timeout (not setInterval) so requests never overlap, and it stops the
  // moment the status leaves pending/processing — no idle spinning.
  useEffect(() => {
    if (!isInFlight(reportStatus)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const res = await getReportStatusAction(contextId);
      if (cancelled) return;
      if (res.success) {
        const next = res.data.status;
        if (next !== reportStatus) {
          setReportStatus(next);
          if (!isInFlight(next)) {
            // Terminal: refresh the workspace so the lifecycle/calculations and
            // generated-at timestamp reflect the finished job.
            router.refresh();
            return;
          }
        }
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reportStatus, contextId, router]);

  const onCalculate = () =>
    startCalc(async () => {
      setCalcError(null);
      const res = await calculateExperimentAction(contextId);
      if (!res.success) {
        setCalcError(res.error);
        return;
      }
      setCalcDoneThisSession(true);
      router.refresh();
    });

  const onGenerate = () =>
    startGen(async () => {
      setGenError(null);
      setCloseError(null);
      const res = await generateReportAction(contextId);
      if (!res.success) {
        setGenError(res.error);
        return;
      }
      setReportStatus(res.data.status);
    });

  const onClose = () => {
    startClose(async () => {
      setCloseError(null);
      const res = await closeTicketAction(contextId);
      if (!res.success) {
        setCloseError(res.error);
        return;
      }
      setCloseModalOpen(false);
      router.refresh();
    });
  };

  const generateLabel =
    isReady(reportStatus) || isFailed(reportStatus)
      ? "Regenerate report"
      : "Generate report";

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" gap="sm">
          <Title order={4}>Finalize</Title>
          <Badge color={meta.color} variant="light" radius="sm">
            Report: {meta.label}
          </Badge>
        </Group>

        <Group gap="sm" wrap="wrap">
          {hasCalculations && (
            <Button
              variant="light"
              onClick={onCalculate}
              loading={calcPending}
              disabled={inFlight || closePending}
              size="sm"
            >
              {calculationsReady || calcDoneThisSession ? "Recalculate" : "Calculate"}
            </Button>
          )}
          <Button
            onClick={onGenerate}
            loading={genPending || inFlight}
            disabled={!calcSatisfied || inFlight || closePending}
            size="sm"
          >
            {generateLabel}
          </Button>
          {reportIsReady && (
            <>
              <Button
                component="a"
                href={experimentReportViewPath(contextId)}
                target="_blank"
                rel="noreferrer"
                variant="light"
                size="sm"
              >
                View report
              </Button>
              <Button
                component="a"
                href={experimentReportDownloadPath(contextId)}
                variant="subtle"
                size="sm"
                download
              >
                Download
              </Button>
            </>
          )}
          <Button
            color="green"
            onClick={() => setCloseModalOpen(true)}
            loading={closePending}
            disabled={!canClose || closePending}
            size="sm"
          >
            Close ticket
          </Button>
        </Group>

        <Text size="xs" c="dimmed">
          {canClose
            ? "Ready to close. Closing locks further calculation and report generation."
            : "Run calculations and generate the report before closing this ticket."}
        </Text>

        {reportIsReady && (
          <Text size="xs" c="teal">
            Report ready
            {reportGeneratedAt ? (
              <>
                {" "}
                since <LocalDateTime iso={reportGeneratedAt} />
              </>
            ) : null}
            .
          </Text>
        )}

        {calcError && (
          <Alert
            color="red"
            variant="light"
            title="Calculation failed"
            style={{ whiteSpace: "pre-line" }}
          >
            {calcError}
          </Alert>
        )}
        {!calcSatisfied && (
          <Text size="xs" c="dimmed">
            Run the calculations first to enable report generation.
          </Text>
        )}
        {isFailed(reportStatus) && (
          <Text size="sm" c="red">
            Report generation failed. You can try again.
          </Text>
        )}
        {genError && (
          <Alert
            color="red"
            variant="light"
            title="Could not generate report"
            style={{ whiteSpace: "pre-line" }}
          >
            {genError}
          </Alert>
        )}
        {closeError && (
          <Alert
            color="red"
            variant="light"
            title="Could not close ticket"
            style={{ whiteSpace: "pre-line" }}
          >
            {closeError}
          </Alert>
        )}
      </Stack>
      <Modal
        opened={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Close ticket?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This will mark the ticket as closed. Calculations and report
            generation will no longer be available after closing.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setCloseModalOpen(false)}
              disabled={closePending}
            >
              Cancel
            </Button>
            <Button color="green" onClick={onClose} loading={closePending}>
              Close ticket
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
