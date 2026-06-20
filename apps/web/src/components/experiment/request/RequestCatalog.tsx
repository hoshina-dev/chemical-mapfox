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
import { useMemo, useState } from "react";

import { LinkButton } from "@/components/links";
import type { CatalogGroup } from "@/lib/experiment/data";
import { requestTemplatePath } from "@/lib/experiment/routes";

export function RequestCatalog({ groups }: { groups: CatalogGroup[] }) {
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
        const templates = group.templates.filter((t) =>
          specimenMatches
            ? true
            : [t.title, t.description].some((v) =>
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
          placeholder="Search specimens or experiments…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={320}
          aria-label="Search the catalogue"
        />
        <Text size="sm" c="dimmed">
          {matchCount} of {totalTemplates} experiment
          {totalTemplates === 1 ? "" : "s"}
        </Text>
      </Group>

      {filtered.length === 0 ? (
        <Paper withBorder radius="md">
          <Box p="xl">
            <Text c="dimmed" ta="center" size="sm">
              {totalTemplates === 0
                ? "No specimens are available yet."
                : "No experiments match your search."}
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
                    No templates available yet.
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {group.templates.map((t) => (
                      <Card key={t.templateId} withBorder radius="md" padding="md">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Stack gap={2} style={{ minWidth: 0 }}>
                            <Text fw={500}>{t.title}</Text>
                            {t.description && (
                              <Text size="sm" c="dimmed">
                                {t.description}
                              </Text>
                            )}
                          </Stack>
                          <LinkButton
                            href={requestTemplatePath(t.templateId, t.sampleId)}
                            size="xs"
                          >
                            Request
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
