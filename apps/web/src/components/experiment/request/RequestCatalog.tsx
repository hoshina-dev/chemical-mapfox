"use client";

import {
  Accordion,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Card,
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

  const totalTemplates = useMemo(
    () => groups.reduce((sum, group) => sum + group.templates.length, 0),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => {
        const specimenMatches = group.sampleName.toLowerCase().includes(q);
        const templates = group.templates.filter((tpl) =>
          specimenMatches
            ? true
            : [tpl.title, tpl.description].some((v) =>
                v?.toLowerCase().includes(q),
              ),
        );
        if (templates.length === 0 && !specimenMatches) return null;
        return { ...group, templates };
      })
      .filter((group): group is CatalogGroup => group !== null);
  }, [groups, query]);

  const matchCount = useMemo(
    () => filtered.reduce((sum, group) => sum + group.templates.length, 0),
    [filtered],
  );

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
          {t("experimentCount", { visible: matchCount, total: totalTemplates })}
        </Text>
      </Group>

      {filtered.length === 0 ? (
        <Paper withBorder radius="md">
          <Box p="xl">
            <Text c="dimmed" ta="center" size="sm">
              {totalTemplates === 0 ? t("noSpecimens") : t("noMatches")}
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
                  <Stack gap="sm">
                    {group.templates.map((tpl) => (
                      <Card key={tpl.templateId} withBorder radius="md" padding="md">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Stack gap={2} style={{ minWidth: 0 }}>
                            <Text fw={500}>{tpl.title}</Text>
                            {tpl.description && (
                              <Text size="sm" c="dimmed">
                                {tpl.description}
                              </Text>
                            )}
                          </Stack>
                          <LinkButton
                            href={requestTemplatePath(tpl.templateId, tpl.sampleId)}
                            size="xs"
                          >
                            {t("requestButton")}
                          </LinkButton>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
