"use client";

import {
  Accordion,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { LinkButton } from "@/components/links";
import type { CatalogGroup } from "@/lib/experiment/data";
import { requestTemplatePath } from "@/lib/experiment/routes";

export function RequestCatalog({ groups }: { groups: CatalogGroup[] }) {
  const t = useTranslations("experiment.request.catalog");
  const [query, setQuery] = useState("");
  // Ticked methods per sample type; one request = one sample with these methods.
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  // Search finds sample types by name; a match keeps all its methods.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((group) => group.sampleName.toLowerCase().includes(q)) : groups;
  }, [groups, query]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={320}
          aria-label={t("searchAriaLabel")}
        />
        <Text size="sm" c="dimmed">
          {t("sampleCount", { visible: filtered.length, total: groups.length })}
        </Text>
      </Group>

      {filtered.length === 0 ? (
        <Paper withBorder radius="md">
          <Box p="xl">
            <Text c="dimmed" ta="center" size="sm">
              {groups.length === 0 ? t("noSpecimens") : t("noMatches")}
            </Text>
          </Box>
        </Paper>
      ) : (
        <Accordion multiple variant="separated" radius="md">
          {filtered.map((group) => (
            <AccordionItem key={group.sampleId} value={group.sampleId}>
              <AccordionControl>
                <Group gap="sm" wrap="nowrap">
                  <Text fw={500}>{group.sampleName}</Text>
                  <Badge size="sm" variant="light" color="gray" circle>
                    {group.templates.length}
                  </Badge>
                </Group>
                {group.sampleDescription && (
                  <Text size="xs" c="dimmed" mt={2}>
                    {group.sampleDescription}
                  </Text>
                )}
              </AccordionControl>
              <AccordionPanel>
                {group.templates.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("noTemplates")}
                  </Text>
                ) : (
                  <SampleMethods
                    group={group}
                    chosen={selected[group.sampleId] ?? []}
                    onChange={(ids) => setSelected((prev) => ({ ...prev, [group.sampleId]: ids }))}
                  />
                )}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}

/** A sample type's methods as tick boxes, with one Request button for the ticked ones. */
function SampleMethods({
  group,
  chosen,
  onChange,
}: {
  group: CatalogGroup;
  chosen: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("experiment.request.catalog");
  // In catalogue order, whatever order they were ticked in.
  const ordered = group.templates.map((tpl) => tpl.templateId).filter((id) => chosen.includes(id));
  const [first, ...rest] = ordered;
  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        {first ? (
          <LinkButton href={requestTemplatePath(first, rest)} size="xs">
            {t("requestSelected", { count: ordered.length })}
          </LinkButton>
        ) : (
          <Text size="sm" c="dimmed">
            {t("tickToRequest")}
          </Text>
        )}
      </Group>
      <Checkbox.Group value={chosen} onChange={onChange}>
        <Stack gap="xs">
          {group.templates.map((tpl) => (
            <Checkbox
              key={tpl.templateId}
              value={tpl.templateId}
              label={tpl.title}
              description={tpl.description ?? undefined}
            />
          ))}
        </Stack>
      </Checkbox.Group>
    </Stack>
  );
}
