"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Code,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  TextInput,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type {
  DishCalculation,
  DishRun,
  DishToleranceRule,
  FormDoc,
  NestedQuestion,
  Question,
} from "@repo/forms";
import { useTranslations } from "next-intl";

import type { FormDraft } from "@/lib/builder";
import { generateDishFormula } from "@/lib/forms/dishFormula";

/**
 * Authoring for a dish run. The measurements taken from
 * each dish, the calculations over them, and which result is compared between
 * dishes against an acceptable error.
 */

/** Fixed id for the dish group: one dish run per method. */
const DISH_GROUP_ID = "dishes";

export interface DishRunEditorProps {
  form: UseFormReturnType<FormDraft>;
}

function findGroup(labForm: FormDoc): Question | undefined {
  return labForm.questions.find((q) => q.id === DISH_GROUP_ID);
}

function measurementsOf(labForm: FormDoc): NestedQuestion[] {
  const group = findGroup(labForm);
  return group?.type === "repeatable-group" ? group.config.questions : [];
}

export function DishRunEditor({ form }: DishRunEditorProps) {
  const t = useTranslations("builder.dishRun");
  const labForm = form.values.labForm;
  const dishRun = labForm.dishRun;
  const enabled = dishRun !== undefined;
  const measurements = measurementsOf(labForm);

  const dishCalcs: DishCalculation[] = dishRun?.calculations ?? [];

  /** Resolve a referenced name to its per-dish series, for the preview. */
  const seriesFor = (index: number) => (name: string) => {
    if (measurements.some((m) => m.id === name)) return `values['${name}']`;
    // Only entries before this one, matching what `fromDraft` generates.
    const earlier = dishCalcs
      .slice(0, index)
      .map((calc) => calc.name.trim())
      .filter(Boolean);
    return earlier.includes(name) ? name : undefined;
  };

  const setDishRun = (next: Partial<DishRun>) => {
    const current: DishRun = dishRun ?? {
      group: DISH_GROUP_ID,
      maxDishes: 8,
      rules: [],
      calculations: [],
    };
    form.setFieldValue("labForm.dishRun", { ...current, ...next });
  };

  const enable = (on: boolean) => {
    if (!on) {
      form.setFieldValue("labForm.dishRun", undefined);
      return;
    }
    if (!findGroup(labForm)) {
      const group: Question = {
        id: DISH_GROUP_ID,
        type: "repeatable-group",
        label: t("groupLabel"),
        config: { count: 8, itemLabel: t("itemLabel"), questions: [] },
      };
      form.setFieldValue("labForm.questions", [...labForm.questions, group]);
    }
    setDishRun({ group: DISH_GROUP_ID, maxDishes: 8, rules: [], calculations: [] });
  };

  /**
   * A method may compare several quantities. **All** of them must agree for a
   * pair of dishes to be accepted, so there is still exactly one accepted pair
   * per experiment.
   */
  const rules = dishRun?.rules ?? [];

  /** Anything with a per-dish value can be compared: calculations or readings. */
  const comparableOptions = [
    {
      group: t("finalsFromCalculations"),
      items: dishCalcs.map((calc) => calc.name.trim()).filter(Boolean),
    },
    {
      group: t("finalsFromMeasurements"),
      items: measurements.map((m) => m.id).filter(Boolean),
    },
  ].filter((entry) => entry.items.length > 0);

  const setRules = (next: DishToleranceRule[]) => setDishRun({ rules: next });

  const updateRule = (index: number, patch: Partial<DishToleranceRule>) => {
    setRules(
      rules.map((entry, i) => {
        if (i !== index) return entry;
        const merged = { ...entry, ...patch };
        // `decimals` is optional; carrying an explicit undefined through would
        // write the key as null on save.
        if (merged.decimals === undefined) delete merged.decimals;
        return merged;
      }),
    );
  };

  const addRule = () => {
    const taken = new Set(rules.map((entry) => entry.target));
    const free = comparableOptions
      .flatMap((entry) => entry.items)
      .find((name) => !taken.has(name));
    setRules([
      ...rules,
      {
        target: free ?? "",
        label: free ?? "",
        limit: { kind: "absolute", value: 0.3 },
      },
    ]);
  };

  const removeRule = (index: number) =>
    setRules(rules.filter((_, i) => i !== index));

  const groupIndex = labForm.questions.findIndex((q) => q.id === DISH_GROUP_ID);
  const childrenPath = `labForm.questions.${groupIndex}.config.questions`;

  const addMeasurement = () => {
    form.insertListItem(childrenPath, {
      id: "",
      label: "",
      type: "number",
      config: {},
    } satisfies NestedQuestion);
  };

  const addCalculation = () => {
    form.insertListItem("labForm.dishRun.calculations", {
      name: "",
      expression: "",
    } satisfies DishCalculation);
  };

  /** Renaming a calculation carries any rule and reported value with it. */
  const renameCalculation = (index: number, nextName: string) => {
    const previous = dishCalcs[index]?.name;
    form.setFieldValue(`labForm.dishRun.calculations.${index}.name`, nextName);
    if (!previous || previous === nextName) return;
    const touched = rules.some((entry) => entry.target === previous);
    if (touched) {
      form.setFieldValue(
        "labForm.dishRun.rules",
        rules.map((entry) =>
          entry.target === previous
            ? {
                ...entry,
                target: nextName,
                label: entry.label === previous ? nextName : entry.label,
              }
            : entry,
        ),
      );
    }
    const finals = dishRun?.finals ?? [];
    if (finals.includes(previous)) {
      form.setFieldValue(
        "labForm.dishRun.finals",
        finals.map((name) => (name === previous ? nextName : name)),
      );
    }
  };

  /** Removing one drops anything that pointed at it. */
  const removeCalculation = (index: number) => {
    const removed = dishCalcs[index]?.name;
    form.removeListItem("labForm.dishRun.calculations", index);
    if (!removed) return;
    if (rules.some((entry) => entry.target === removed)) {
      form.setFieldValue(
        "labForm.dishRun.rules",
        rules.filter((entry) => entry.target !== removed),
      );
    }
    const finals = dishRun?.finals ?? [];
    if (finals.includes(removed)) {
      form.setFieldValue(
        "labForm.dishRun.finals",
        finals.filter((name) => name !== removed),
      );
    }
  };

  return (
    <Stack gap="md">
      <Switch
        checked={enabled}
        onChange={(event) => enable(event.currentTarget.checked)}
        label={t("enable")}
        description={t("enableHint")}
      />

      {enabled && dishRun && (
        <>
          <NumberInput
            label={t("maxDishes")}
            description={t("maxDishesHint")}
            min={2}
            max={20}
            value={dishRun.maxDishes}
            onChange={(value) => {
              const max = typeof value === "number" ? value : 8;
              setDishRun({ maxDishes: max });
              if (groupIndex >= 0) {
                form.setFieldValue(
                  `labForm.questions.${groupIndex}.config.count`,
                  max,
                );
              }
            }}
          />

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t("measurements")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("measurementsHint")}
            </Text>
            {measurements.length === 0 && (
              <Text size="sm" c="dimmed">
                {t("noMeasurements")}
              </Text>
            )}
            {measurements.map((child, index) => (
              <Group key={index} gap="xs" wrap="nowrap" align="flex-end">
                <TextInput
                  style={{ flex: 1 }}
                  label={index === 0 ? t("measurementId") : undefined}
                  placeholder={t("measurementIdPlaceholder")}
                  value={child.id}
                  onChange={(event) =>
                    form.setFieldValue(
                      `${childrenPath}.${index}.id`,
                      event.currentTarget.value,
                    )
                  }
                />
                <TextInput
                  style={{ flex: 2 }}
                  label={index === 0 ? t("measurementLabel") : undefined}
                  placeholder={t("measurementLabelPlaceholder")}
                  value={child.label}
                  onChange={(event) =>
                    form.setFieldValue(
                      `${childrenPath}.${index}.label`,
                      event.currentTarget.value,
                    )
                  }
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  aria-label={t("removeMeasurement")}
                  onClick={() => form.removeListItem(childrenPath, index)}
                >
                  ✕
                </ActionIcon>
              </Group>
            ))}
            <Group>
              <Button size="xs" variant="light" onClick={addMeasurement}>
                {t("addMeasurement")}
              </Button>
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t("calculations")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("calculationsHint")}
            </Text>
            {dishCalcs.length === 0 && (
              <Text size="sm" c="dimmed">
                {t("noCalculations")}
              </Text>
            )}
            {dishCalcs.map((calc, index) => {
              const generated = generateDishFormula(calc.expression, seriesFor(index));
              return (
                <Stack key={index} gap={4}>
                  <Group gap="xs" wrap="nowrap" align="flex-end">
                    <TextInput
                      style={{ flex: 1 }}
                      label={index === 0 ? t("calculationName") : undefined}
                      placeholder={t("calculationNamePlaceholder")}
                      value={calc.name}
                      onChange={(event) =>
                        renameCalculation(index, event.currentTarget.value)
                      }
                    />
                    <TextInput
                      style={{ flex: 2 }}
                      label={index === 0 ? t("expression") : undefined}
                      placeholder={t("expressionPlaceholder")}
                      value={calc.expression}
                      error={
                        calc.expression !== "" && !generated.ok
                          ? t(`error.${generated.code}`, { name: generated.name ?? "" })
                          : undefined
                      }
                      onChange={(event) =>
                        form.setFieldValue(
                          `labForm.dishRun.calculations.${index}.expression`,
                          event.currentTarget.value,
                        )
                      }
                    />
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label={t("removeCalculation")}
                      onClick={() => removeCalculation(index)}
                    >
                      ✕
                    </ActionIcon>
                  </Group>
                  {generated.ok && (
                    <Code block style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
                      {generated.formula}
                    </Code>
                  )}
                </Stack>
              );
            })}
            <Group>
              <Button
                size="xs"
                variant="light"
                disabled={measurements.length === 0}
                onClick={addCalculation}
              >
                {t("addCalculation")}
              </Button>
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t("tolerance")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("toleranceHint")}
            </Text>
            {rules.map((entry, index) => (
              <Group key={index} gap="xs" wrap="nowrap" align="flex-end">
                <Select
                  style={{ flex: 1 }}
                  label={index === 0 ? t("target") : undefined}
                  placeholder={t("targetPlaceholder")}
                  data={comparableOptions}
                  value={entry.target === "" ? null : entry.target}
                  onChange={(value) =>
                    updateRule(index, {
                      target: value ?? "",
                      label: entry.label === entry.target ? (value ?? "") : entry.label,
                    })
                  }
                />
                <NumberInput
                  style={{ flex: 1 }}
                  label={index === 0 ? t("limit") : undefined}
                  description={index === 0 ? t("limitHint") : undefined}
                  min={0}
                  step={0.01}
                  decimalScale={4}
                  value={entry.limit.value}
                  onChange={(value) =>
                    updateRule(index, {
                      limit: {
                        kind: "absolute",
                        value: typeof value === "number" ? value : 0,
                      },
                    })
                  }
                />
                <NumberInput
                  style={{ flex: 1 }}
                  label={index === 0 ? t("decimals") : undefined}
                  description={index === 0 ? t("decimalsHint") : undefined}
                  min={0}
                  max={6}
                  value={entry.decimals ?? ""}
                  onChange={(value) =>
                    updateRule(index, {
                      decimals: typeof value === "number" ? value : undefined,
                    })
                  }
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  aria-label={t("removeComparison")}
                  onClick={() => removeRule(index)}
                >
                  ✕
                </ActionIcon>
              </Group>
            ))}
            <Group>
              <Button
                size="xs"
                variant="light"
                disabled={comparableOptions.length === 0}
                onClick={addRule}
              >
                {t("addComparison")}
              </Button>
            </Group>
            {rules.some((entry) => entry.decimals === undefined) && (
              <Alert color="yellow" variant="light" title={t("roundingWarningTitle")}>
                {t("roundingWarning")}
              </Alert>
            )}
            {rules.length === 0 && (
              <Alert color="gray" variant="light">
                {t("noTolerance")}
              </Alert>
            )}
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {t("finals")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("finalsHint")}
            </Text>
            <MultiSelect
              label={t("finalsLabel")}
              placeholder={
                (dishRun.finals ?? []).length === 0 ? t("finalsPlaceholder") : undefined
              }
              data={[
                {
                  group: t("finalsFromCalculations"),
                  items: dishCalcs
                    .map((calc) => calc.name.trim())
                    .filter((name) => name !== ""),
                },
                {
                  group: t("finalsFromMeasurements"),
                  items: measurements.map((m) => m.id).filter((id) => id !== ""),
                },
              ]}
              value={dishRun.finals ?? []}
              onChange={(value) => setDishRun({ finals: value })}
              clearable
            />
            {(dishRun.finals ?? []).length === 0 ? (
              <Alert color="yellow" variant="light" title={t("noFinalsTitle")}>
                {t("noFinals")}
              </Alert>
            ) : (
              <Text size="xs" c="dimmed">
                {t("finalsGenerated", {
                  names: (dishRun.finals ?? []).map((n) => `final_${n}`).join(", "),
                })}
              </Text>
            )}
          </Stack>

          {rules.length > 0 && measurements.length > 0 && (
            <Table withTableBorder verticalSpacing="xs">
              <TableThead>
                <TableTr>
                  <TableTh>{t("summary.title")}</TableTh>
                  <TableTh />
                </TableTr>
              </TableThead>
              <TableTbody>
                <TableTr>
                  <TableTd>{t("summary.measured")}</TableTd>
                  <TableTd>{measurements.map((m) => m.id).join(", ")}</TableTd>
                </TableTr>
                <TableTr>
                  <TableTd>
                    {rules.length > 1 ? t("summary.comparedAll") : t("summary.compared")}
                  </TableTd>
                  <TableTd>
                    <Stack gap={2}>
                      {rules.map((entry, index) => (
                        <Text key={index} size="sm">
                          {t("summary.comparedValue", {
                            target: entry.target,
                            limit: entry.limit.value,
                          })}
                        </Text>
                      ))}
                    </Stack>
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd>{t("summary.reported")}</TableTd>
                  <TableTd>
                    {(dishRun.finals ?? []).length > 0
                      ? (dishRun.finals ?? []).join(", ")
                      : t("summary.nothingReported")}
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd>{t("summary.dishes")}</TableTd>
                  <TableTd>{dishRun.maxDishes}</TableTd>
                </TableTr>
              </TableTbody>
            </Table>
          )}
        </>
      )}
    </Stack>
  );
}
