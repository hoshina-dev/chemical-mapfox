"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  Loader,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from "@mantine/core";
import { useTranslations } from "next-intl";

import type { DishRunState } from "@/lib/forms/dishRun";
import {
  describeDishRunIssue,
  dishRunHeadline,
  dishRunTone,
} from "@/lib/forms/dishRunMessages";

export interface DishRunPanelProps {
  state: DishRunState;
  /** Shown while a fresh evaluation is in flight, so stale numbers read as stale. */
  pending?: boolean;
  /** Dish values have changed since this state was computed. */
  stale?: boolean;
  /** Re-evaluate. Omitted in the read-only view, which cannot change anything. */
  onCheck?: () => void;
  /** Label for the check action — differs before and after the first check. */
  checkLabel?: string;
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : String(value);
}

/**
 * The lab's actual decision, made visible: which pairs of dishes have been
 * compared, how far apart they were, which pair was accepted, and the final
 * value that follows from it.
 */
export function DishRunPanel({
  state,
  pending,
  stale,
  onCheck,
  checkLabel,
}: DishRunPanelProps) {
  const t = useTranslations("staff.dishRun");

  if (state.phase === "INACTIVE") return null;

  const tone = stale ? "gray" : dishRunTone(state);
  const rules = state.pairs[0]?.rules ?? [];

  return (
    <Stack gap="sm">
      {onCheck && (
        <Group justify="space-between">
          <Text size="sm" c={stale ? undefined : "dimmed"}>
            {stale ? t("staleHint") : t("checkHint")}
          </Text>
          <Button
            size="sm"
            variant={stale ? "filled" : "default"}
            loading={pending}
            onClick={onCheck}
          >
            {checkLabel ?? t("check")}
          </Button>
        </Group>
      )}

      <Alert
        color={tone}
        variant="light"
        title={
          <Group gap="xs">
            <span>{dishRunHeadline(t, state)}</span>
            {pending && <Loader size="xs" />}
          </Group>
        }
      >
        {state.phase === "CONFIG_ERROR" && state.issues.length > 0 && (
          <List size="sm">
            {state.issues.map((issue, index) => (
              <List.Item key={`${issue.code}:${issue.target ?? index}`}>
                {describeDishRunIssue(t, issue)}
              </List.Item>
            ))}
          </List>
        )}
        {state.staleDishes.length > 0 && (
          <Text size="sm">
            {t("staleDishes", {
              dishes: state.staleDishes.join(", "),
              count: state.staleDishes.length,
            })}
          </Text>
        )}
      </Alert>

      {state.pairs.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t("pairs.title")}
            </Text>
            <Table verticalSpacing="xs" horizontalSpacing="md" withRowBorders={false}>
              <TableThead>
                <TableTr>
                  <TableTh>{t("pairs.pair")}</TableTh>
                  {rules.map((rule) => (
                    <TableTh key={rule.target}>
                      {t("pairs.difference", { label: rule.label })}
                    </TableTh>
                  ))}
                  <TableTh />
                </TableTr>
              </TableThead>
              <TableTbody>
                {state.pairs.map((pair) => {
                  const won =
                    state.acceptedPair?.[0] === pair.a && state.acceptedPair?.[1] === pair.b;
                  return (
                    <TableTr
                      key={`${pair.a}-${pair.b}`}
                      style={
                        won
                          ? { backgroundColor: "var(--mantine-color-teal-light)" }
                          : undefined
                      }
                    >
                      <TableTd>
                        <Text size="sm" fw={won ? 600 : 400}>
                          {t("pairs.dishes", { a: pair.a, b: pair.b })}
                        </Text>
                      </TableTd>
                      {pair.rules.map((rule) => (
                        <TableTd key={rule.target}>
                          {rule.diff === null ? (
                            <Text size="sm" c="dimmed">
                              {t("pairs.notMeasured")}
                            </Text>
                          ) : (
                            <Text size="sm" c={rule.within ? undefined : "red"}>
                              {t("pairs.diffAgainstLimit", {
                                diff: rule.diff,
                                limit: rule.limit,
                              })}
                            </Text>
                          )}
                        </TableTd>
                      ))}
                      <TableTd>
                        {won && (
                          <Badge color="teal" variant="light" size="sm">
                            {t("pairs.accepted")}
                          </Badge>
                        )}
                      </TableTd>
                    </TableTr>
                  );
                })}
              </TableTbody>
            </Table>
          </Stack>
        </Card>
      )}

      {state.reported.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {state.acceptedPair
                ? t("final.title", {
                    a: state.acceptedPair[0],
                    b: state.acceptedPair[1],
                  })
                : t("final.pendingTitle")}
            </Text>
            {/* These are the engine's own `final_*` calculations, so what shows
                here is exactly what the certificate will print. */}
            {state.reported.map((final) => (
              <Group key={final.calculation} justify="space-between">
                <Text size="sm">{final.label}</Text>
                <Text size="sm" fw={600} ff="monospace">
                  {formatNumber(final.value)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
