"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  calculateExperimentAction,
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

  const inFlight = isInFlight(reportStatus);
  // Report generation depends on calculations: allowed once they've been run
  // (or the template has none). `calcDoneThisSession` reflects a calculate that
  // just succeeded before the server-rendered `calculationsReady` catches up.
  const calcSatisfied =
    !hasCalculations || calculationsReady || calcDoneThisSession;
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
      const res = await generateReportAction(contextId);
      if (!res.success) {
        setGenError(res.error);
        return;
      }
      setReportStatus(res.data.status);
    });

  const generateLabel =
    isReady(reportStatus) || isFailed(reportStatus)
      ? "Regenerate report"
      : "Generate report";

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={4}>Finalize experiment</Title>
          <Badge color={meta.color} variant="light" radius="sm">
            {meta.label}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {hasCalculations
            ? "Run the calculations, then generate the PDF report. The report uses the calculated results, so calculate first."
            : "Generate the PDF report for this experiment."}
        </Text>

        {hasCalculations && (
          <Stack gap={6}>
            <Group gap="sm">
              <Button
                variant="light"
                onClick={onCalculate}
                loading={calcPending}
                disabled={inFlight}
              >
                {calculationsReady || calcDoneThisSession
                  ? "Recalculate"
                  : "Calculate"}
              </Button>
              {(calculationsReady || calcDoneThisSession) && (
                <Text size="sm" c="teal">
                  Calculations are up to date.
                </Text>
              )}
            </Group>
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
          </Stack>
        )}

        <Stack gap={6}>
          <Group gap="sm">
            <Button
              onClick={onGenerate}
              loading={genPending || inFlight}
              disabled={!calcSatisfied || inFlight}
            >
              {generateLabel}
            </Button>
          </Group>
          {!calcSatisfied && (
            <Text size="xs" c="dimmed">
              Run the calculations first to enable report generation.
            </Text>
          )}
          {isReady(reportStatus) && (
            <Alert color="teal" variant="light" title="Report is ready">
              <Stack gap="sm">
                <Text size="sm">
                  {reportGeneratedAt ? (
                    <>
                      Generated <LocalDateTime iso={reportGeneratedAt} />.{" "}
                    </>
                  ) : null}
                  Open the PDF in your browser to review it before saving a copy.
                </Text>
                <Group gap="sm">
                  <Button
                    component="a"
                    href={experimentReportViewPath(contextId)}
                    target="_blank"
                    rel="noreferrer"
                    size="sm"
                  >
                    View report
                  </Button>
                  <Button
                    component="a"
                    href={experimentReportDownloadPath(contextId)}
                    variant="light"
                    size="sm"
                    download
                  >
                    Download PDF
                  </Button>
                </Group>
              </Stack>
            </Alert>
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
        </Stack>
      </Stack>
    </Card>
  );
}
