"use client";

import { useState } from "react";
import {
  ActionIcon,
  Button,
  Code,
  Divider,
  Drawer,
  Group,
  Input,
  List,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useTranslations } from "next-intl";

import type { FormDraft } from "@/lib/builder";

import { CollapsiblePanel } from "./CollapsiblePanel";
import { CompactFormulaEditor } from "./CompactFormulaEditor";
import { MonacoFormulaEditor } from "./MonacoFormulaEditor";

interface CalculationsEditorProps {
  form: UseFormReturnType<FormDraft>;
}

interface CalcRowProps {
  isFirst: boolean;
  formula: string;
  onFormulaChange: (value: string) => void;
  onExpand: () => void;
  nameProps: ReturnType<UseFormReturnType<FormDraft>["getInputProps"]>;
  onDelete: () => void;
}

function CalcRow({
  isFirst,
  formula,
  onFormulaChange,
  onExpand,
  nameProps,
  onDelete,
}: CalcRowProps) {
  const t = useTranslations("builder.calculations");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <TextInput
        label={isFirst ? t("name") : undefined}
        placeholder={t("namePlaceholder")}
        style={{ flex: 1 }}
        {...nameProps}
      />
      <Input.Wrapper label={isFirst ? t("formula") : undefined} style={{ flex: 2 }}>
        <CompactFormulaEditor
          value={formula}
          onChange={onFormulaChange}
          onExpand={onExpand}
          placeholder={t("formulaPlaceholder")}
        />
      </Input.Wrapper>
      <Group gap={4} wrap="nowrap" mt={isFirst ? 25 : 0}>
        <Tooltip label={t("openCodeEditor")}>
          <ActionIcon variant="subtle" onClick={onExpand} aria-label={t("openCodeEditor")}>
            ⤢
          </ActionIcon>
        </Tooltip>
        {confirmDelete ? (
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="red" fw={600}>
              {t("deleteConfirm")}
            </Text>
            <Button size="compact-xs" color="red" onClick={onDelete}>
              {t("yes")}
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setConfirmDelete(false)}
            >
              {t("no")}
            </Button>
          </Group>
        ) : (
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => setConfirmDelete(true)}
            aria-label={t("remove")}
          >
            ✕
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}

export function CalculationsEditor({ form }: CalculationsEditorProps) {
  const t = useTranslations("builder.calculations");
  const calcs = form.values.calculations;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeCalc = activeIndex === null ? null : calcs[activeIndex];

  return (
    <CollapsiblePanel
      title={t("title")}
      subtitle={t("subtitle")}
      badge={t("formulaCount", { count: calcs.length })}
    >
      <Stack gap="sm" style={{ width: "100%" }}>
        {calcs.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("none")}
          </Text>
        )}
        {calcs.map((calc, i) => (
          <CalcRow
            key={i}
            isFirst={i === 0}
            formula={calc.formula}
            onFormulaChange={(value) =>
              form.setFieldValue(`calculations.${i}.formula`, value)
            }
            onExpand={() => setActiveIndex(i)}
            nameProps={form.getInputProps(`calculations.${i}.name`)}
            onDelete={() => form.removeListItem("calculations", i)}
          />
        ))}
        <Group>
          <Button
            size="xs"
            variant="light"
            onClick={() =>
              form.insertListItem("calculations", { name: "", formula: "" })
            }
          >
            {t("add")}
          </Button>
        </Group>
      </Stack>

      <Drawer
        opened={activeIndex !== null}
        onClose={() => setActiveIndex(null)}
        position="right"
        size="lg"
        title={
          <Text fw={600}>
            {activeCalc?.name
              ? t("editFormulaNamed", { name: activeCalc.name })
              : t("editFormula")}
          </Text>
        }
      >
        {activeIndex !== null && activeCalc && (
          <Stack gap="sm">
            <MonacoFormulaEditor
              value={activeCalc.formula}
              onChange={(value) =>
                form.setFieldValue(`calculations.${activeIndex}.formula`, value)
              }
            />

            <Divider />

            <div>
              <Text size="sm" fw={600}>
                {t("availableInFormulas")}
              </Text>
              <List size="xs" spacing={2} mt={4}>
                <List.Item>
                  <Code>values[&apos;question_id&apos;]</Code> —{" "}
                  {t("helpValues")}
                </List.Item>
                <List.Item>{t("helpOtherCalcs")}</List.Item>
                <List.Item>{t("helpMath")}</List.Item>
                <List.Item>{t("helpBuiltins")}</List.Item>
              </List>
              <Text size="xs" c="dimmed" mt={6}>
                {t("helpMultiline")}
              </Text>
            </div>

            <Group justify="flex-end">
              <Button onClick={() => setActiveIndex(null)}>{t("done")}</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </CollapsiblePanel>
  );
}
