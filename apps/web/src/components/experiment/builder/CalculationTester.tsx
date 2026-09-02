"use client";

import type { AnswerValue, ExperimentTemplate } from "@repo/forms";
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  List,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { testCalculationsAction } from "@/app/actions/experiment-manager";
import type {
  CalculationDryRunResponse,
  CalculationOutcome,
} from "@/lib/experiment-manager/client";

interface CalculationTesterProps {
  template: ExperimentTemplate;
  /** Answers captured from the preview forms; may be empty. */
  values: Record<string, AnswerValue>;
}

const STATUS_COLOR: Record<CalculationOutcome["status"], string> = {
  ok: "green",
  error: "red",
  skipped: "yellow",
};

const STATUS_LABEL: Record<CalculationOutcome["status"], string> = {
  ok: "statusOk",
  error: "statusError",
  skipped: "statusSkipped",
};

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return "—";
  if (typeof result === "number" || typeof result === "string") {
    return String(result);
  }
  return JSON.stringify(result);
}

/**
 * Runs the draft template's formulas through the backend's calculation engine
 * and shows what each one produced. The same engine evaluates real experiments,
 * so a formula that works here works in production — which is the point: catch
 * a typo'd question id or a bad expression during onboarding rather than after
 * a technician has already entered real measurements.
 */
export function CalculationTester({
  template,
  values,
}: CalculationTesterProps) {
  const t = useTranslations("builder.calculationTester");
  const [report, setReport] = useState<CalculationDryRunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const names = Object.keys(template.calculations);

  const run = () => {
    startTransition(async () => {
      const result = await testCalculationsAction(template, values);
      if (!result.success) {
        setReport(null);
        setRunError(result.error);
        return;
      }
      setRunError(null);
      setReport(result.data);
    });
  };

  if (names.length === 0) {
    return (
      <Stack gap="sm">
        <Text size="sm" fw={700} tt="uppercase" c="dimmed">
          {t("title")}
        </Text>
        <Text size="sm" c="dimmed">
          {t("none")}
        </Text>
      </Stack>
    );
  }

  const outcomes = report ? Object.entries(report.calculations) : [];
  const failedCount = outcomes.filter(
    ([, outcome]) => outcome.status !== "ok",
  ).length;

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <div>
          <Text size="sm" fw={700} tt="uppercase" c="dimmed">
            {t("title")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("subtitle")}
          </Text>
        </div>
        <Button onClick={run} loading={isPending} variant="light">
          {report ? t("runAgain") : t("run")}
        </Button>
      </Group>

      {runError && (
        <Alert color="red" variant="light" title={t("failedTitle")}>
          <Text size="sm" style={{ whiteSpace: "pre-line" }}>
            {runError}
          </Text>
        </Alert>
      )}

      {report && (
        <>
          <Alert
            color={failedCount === 0 ? "green" : "red"}
            variant="light"
            title={
              failedCount === 0
                ? t("allPassed", { count: outcomes.length })
                : t("someFailed", { count: failedCount })
            }
          />

          <Table
            striped
            withTableBorder
            highlightOnHover
            aria-label={t("title")}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("name")}</Table.Th>
                <Table.Th>{t("status")}</Table.Th>
                <Table.Th>{t("result")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {outcomes.map(([name, outcome]) => (
                <Table.Tr key={name}>
                  <Table.Td>
                    <Code>{name}</Code>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLOR[outcome.status]}
                      variant="light"
                    >
                      {t(STATUS_LABEL[outcome.status])}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {outcome.error ? (
                      <Text size="sm" c="red">
                        {outcome.error.message}
                      </Text>
                    ) : (
                      <Text size="sm" fw={600}>
                        {formatResult(outcome.result)}
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {report.missing_values.length > 0 && (
            <Alert color="orange" variant="light" title={t("missingTitle")}>
              <Text size="sm">{t("missingBody")}</Text>
              <List size="sm" mt={4}>
                {report.missing_values.map((id) => (
                  <List.Item key={id}>
                    <Code>{id}</Code>
                  </List.Item>
                ))}
              </List>
            </Alert>
          )}

          {report.duplicate_question_ids.length > 0 && (
            <Alert color="orange" variant="light" title={t("duplicateTitle")}>
              <Text size="sm">{t("duplicateBody")}</Text>
              <List size="sm" mt={4}>
                {report.duplicate_question_ids.map((id) => (
                  <List.Item key={id}>
                    <Code>{id}</Code>
                  </List.Item>
                ))}
              </List>
            </Alert>
          )}

          <div>
            <Text size="xs" c="dimmed" mb={4}>
              {t("valuesUsed")}
            </Text>
            <Code block>{JSON.stringify(report.values, null, 2)}</Code>
          </div>
        </>
      )}
    </Stack>
  );
}
