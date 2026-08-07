"use client";

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Input,
  LoadingOverlay,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { Calculations, FormAnswers, FormDoc } from "@repo/forms";
import { FormRenderer } from "@repo/forms";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  calculateExperimentAction,
  closeTicketAction,
  fixExperimentFormulaAction,
  generateReportAction,
  getReportStatusAction,
  updateExperimentValuesAction,
} from "@/app/actions/experiment";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  experimentReportDownloadPath,
  experimentReportViewPath,
} from "@/lib/experiment-manager/routes";

import { CompactFormulaEditor } from "@/components/experiment/builder/CompactFormulaEditor";
import { MonacoFormulaEditor } from "@/components/experiment/builder/MonacoFormulaEditor";

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

const STATUS_META: Record<string, { labelKey: "queued" | "generating" | "ready" | "failed"; color: string }> = {
  pending: { labelKey: "queued", color: "blue" },
  processing: { labelKey: "generating", color: "blue" },
  success: { labelKey: "ready", color: "teal" },
  succeeded: { labelKey: "ready", color: "teal" },
  failed: { labelKey: "failed", color: "red" },
};

const POLL_INTERVAL_MS = 3000;

export interface FinalizingActionsProps {
  contextId: string;
  /** The template defines calculations, so a Calculate step is offered. */
  hasCalculations: boolean;
  /** Every calculation already has a result (or there are none to run). */
  calculationsReady: boolean;
  initialReportStatus: string | null;
  reportGeneratedAt: string | null;
  /** Lab-form doc + current values, so a failed calculation's inputs can be fixed in place. */
  labForm: FormDoc;
  labValues: FormAnswers;
  /** This experiment's own calculations, so a broken formula can be fixed in place. */
  calculations: Calculations;
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
  labForm,
  labValues,
  calculations,
}: FinalizingActionsProps) {
  const t = useTranslations("staff.finalize");
  const tCommon = useTranslations("common");
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

  const [fixChoiceModalOpen, setFixChoiceModalOpen] = useState(false);
  const [fixValuesModalOpen, setFixValuesModalOpen] = useState(false);
  const [fixValuesPending, startFixValues] = useTransition();
  const [fixValuesError, setFixValuesError] = useState<string | null>(null);

  const [fixFormulaModalOpen, setFixFormulaModalOpen] = useState(false);
  const [fixFormulaPending, startFixFormula] = useTransition();
  const [fixFormulaError, setFixFormulaError] = useState<string | null>(null);
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>({});
  const [activeFormulaName, setActiveFormulaName] = useState<string | null>(null);

  const inFlight = isInFlight(reportStatus);
  // Report generation depends on calculations: allowed once they've been run
  // (or the template has none). `calcDoneThisSession` reflects a calculate that
  // just succeeded before the server-rendered `calculationsReady` catches up.
  const calcSatisfied =
    !hasCalculations || calculationsReady || calcDoneThisSession;
  const reportIsReady = isReady(reportStatus);
  const canClose = calcSatisfied && reportIsReady && !inFlight;
  const meta = (() => {
    const normalized = normalizeStatus(reportStatus);
    if (!normalized) return { label: t("status.notGenerated"), color: "gray" };
    const entry = STATUS_META[normalized];
    return entry
      ? { label: t(`status.${entry.labelKey}`), color: entry.color }
      : { label: reportStatus ?? normalized, color: "gray" };
  })();

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

  const onFixValues = (answers: FormAnswers) =>
    startFixValues(async () => {
      setFixValuesError(null);
      const res = await updateExperimentValuesAction(contextId, answers);
      if (!res.success) {
        setFixValuesError(res.error);
        return;
      }
      // The saved values invalidate any prior calculation results, so drop the
      // client's optimistic "done" flag too — Calculate must run again.
      setCalcDoneThisSession(false);
      setCalcError(null);
      setFixValuesModalOpen(false);
      router.refresh();
    });

  const openFixFormula = () => {
    setFormulaDrafts(
      Object.fromEntries(
        Object.entries(calculations).map(([name, calc]) => [name, calc.formula]),
      ),
    );
    setFixFormulaError(null);
    setFixChoiceModalOpen(false);
    setFixFormulaModalOpen(true);
  };

  const onFixFormula = () =>
    startFixFormula(async () => {
      setFixFormulaError(null);
      const payload = Object.fromEntries(
        Object.entries(formulaDrafts).map(([name, formula]) => [name, { formula }]),
      );
      const res = await fixExperimentFormulaAction(contextId, payload);
      if (!res.success) {
        setFixFormulaError(res.error);
        return;
      }
      // The result was reset server-side; drop the optimistic "done" flag too.
      setCalcDoneThisSession(false);
      setCalcError(null);
      setFixFormulaModalOpen(false);
      router.refresh();
    });

  const generateLabel =
    isReady(reportStatus) || isFailed(reportStatus)
      ? t("regenerateReport")
      : t("generateReport");

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" gap="sm">
          <Title order={4}>{t("title")}</Title>
          <Badge color={meta.color} variant="light" radius="sm">
            {t("reportBadge", { status: meta.label })}
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
              {calculationsReady || calcDoneThisSession
                ? t("recalculate")
                : t("calculate")}
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
                {t("viewReport")}
              </Button>
              <Button
                component="a"
                href={experimentReportDownloadPath(contextId)}
                variant="subtle"
                size="sm"
                download
              >
                {t("download")}
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
            {t("closeTicket")}
          </Button>
          {calcError && labForm.questions.length > 0 && (
            <Button
              variant="subtle"
              color="orange"
              onClick={() => setFixChoiceModalOpen(true)}
              disabled={closePending}
              size="sm"
            >
              {t("fixValues")}
            </Button>
          )}
        </Group>

        <Text size="xs" c="dimmed">
          {canClose ? t("readyToClose") : t("notReadyToClose")}
        </Text>

        {reportIsReady && (
          <Text size="xs" c="teal">
            {reportGeneratedAt
              ? t.rich("reportReadySince", {
                  date: () => <LocalDateTime iso={reportGeneratedAt} />,
                })
              : t("reportReady")}
          </Text>
        )}

        {calcError && (
          <Alert
            color="red"
            variant="light"
            title={t("calcFailedTitle")}
            style={{ whiteSpace: "pre-line" }}
          >
            {calcError}
          </Alert>
        )}
        {!calcSatisfied && (
          <Text size="xs" c="dimmed">
            {t("runCalcsFirst")}
          </Text>
        )}
        {isFailed(reportStatus) && (
          <Text size="sm" c="red">
            {t("reportGenFailed")}
          </Text>
        )}
        {genError && (
          <Alert
            color="red"
            variant="light"
            title={t("genErrorTitle")}
            style={{ whiteSpace: "pre-line" }}
          >
            {genError}
          </Alert>
        )}
        {closeError && (
          <Alert
            color="red"
            variant="light"
            title={t("closeErrorTitle")}
            style={{ whiteSpace: "pre-line" }}
          >
            {closeError}
          </Alert>
        )}
      </Stack>
      <Modal
        opened={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title={t("closeModalTitle")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t("closeModalBody")}</Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setCloseModalOpen(false)}
              disabled={closePending}
            >
              {tCommon("cancel")}
            </Button>
            <Button color="green" onClick={onClose} loading={closePending}>
              {t("closeTicket")}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={fixChoiceModalOpen}
        onClose={() => setFixChoiceModalOpen(false)}
        title={t("fixChoiceTitle")}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("fixChoiceBody")}
          </Text>
          <Card withBorder radius="md" padding="sm">
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {t("fixChoiceValuesTitle")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("fixChoiceValuesBody")}
              </Text>
              <Button
                mt="xs"
                size="sm"
                onClick={() => {
                  setFixChoiceModalOpen(false);
                  setFixValuesModalOpen(true);
                }}
              >
                {t("editValues")}
              </Button>
            </Stack>
          </Card>
          {Object.keys(calculations).length > 0 && (
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  {t("fixChoiceFormulaTitle")}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("fixChoiceFormulaBody")}
                </Text>
                <Button mt="xs" size="sm" variant="light" onClick={openFixFormula}>
                  {t("editFormula")}
                </Button>
              </Stack>
            </Card>
          )}
        </Stack>
      </Modal>
      <Modal
        opened={fixValuesModalOpen}
        onClose={() => setFixValuesModalOpen(false)}
        title={t("fixValuesModalTitle")}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("fixValuesModalBody")}
          </Text>
          {fixValuesError && (
            <Alert
              color="red"
              variant="light"
              title={t("fixValuesErrorTitle")}
              style={{ whiteSpace: "pre-line" }}
            >
              {fixValuesError}
            </Alert>
          )}
          <Box pos="relative">
            <LoadingOverlay visible={fixValuesPending} zIndex={1000} />
            <FormRenderer
              doc={labForm}
              initialValues={labValues}
              submitLabel={t("saveValues")}
              onSubmit={onFixValues}
            />
          </Box>
        </Stack>
      </Modal>
      <Modal
        opened={fixFormulaModalOpen}
        onClose={() => setFixFormulaModalOpen(false)}
        title={t("fixFormulaModalTitle")}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("fixFormulaModalBody")}
          </Text>
          {fixFormulaError && (
            <Alert
              color="red"
              variant="light"
              title={t("fixFormulaErrorTitle")}
              style={{ whiteSpace: "pre-line" }}
            >
              {fixFormulaError}
            </Alert>
          )}
          <Box pos="relative">
            <LoadingOverlay visible={fixFormulaPending} zIndex={1000} />
            <Stack gap="sm">
              {Object.keys(formulaDrafts).map((name) => (
                <Input.Wrapper key={name} label={name}>
                  <CompactFormulaEditor
                    value={formulaDrafts[name] ?? ""}
                    onChange={(value) =>
                      setFormulaDrafts((prev) => ({ ...prev, [name]: value }))
                    }
                    onExpand={() => setActiveFormulaName(name)}
                  />
                </Input.Wrapper>
              ))}
            </Stack>
          </Box>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setFixFormulaModalOpen(false)}
              disabled={fixFormulaPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={onFixFormula} loading={fixFormulaPending}>
              {t("saveFormula")}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Drawer
        opened={activeFormulaName !== null}
        onClose={() => setActiveFormulaName(null)}
        position="right"
        size="lg"
        title={activeFormulaName}
      >
        {activeFormulaName !== null && (
          <Stack gap="sm">
            <MonacoFormulaEditor
              value={formulaDrafts[activeFormulaName] ?? ""}
              onChange={(value) =>
                setFormulaDrafts((prev) => ({ ...prev, [activeFormulaName]: value }))
              }
            />
            <Group justify="flex-end">
              <Button onClick={() => setActiveFormulaName(null)}>
                {tCommon("done")}
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Card>
  );
}
