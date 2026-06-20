"use client";

import {
  Badge,
  Box,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import Link from "next/link";
import { useMemo, useState } from "react";

import { LinkButton } from "@/components/links";
import type { MyExperiment } from "@/lib/experiment/data";
import {
  myExperimentDetailPath,
  requestCatalogPath,
} from "@/lib/experiment/routes";
import { formatDateTime, statusMeta } from "@/lib/ticketing/tickets";

interface Lane {
  key: string;
  label: string;
  /** Mantine color for the column's count badge accent. */
  color: string;
  statuses: string[];
}

// Lifecycle lanes for the Kanban, in flow order. Raw ticket statuses are mapped
// to a lane; anything unrecognised falls into the trailing "Other" lane.
const LANES: Lane[] = [
  {
    key: "requested",
    label: "Requested",
    color: "blue",
    statuses: ["requested", "open", "pending"],
  },
  {
    key: "sample_received",
    label: "Sample received",
    color: "cyan",
    statuses: ["sample_received"],
  },
  {
    key: "in_progress",
    label: "In progress",
    color: "yellow",
    statuses: ["experiment_started", "in_progress"],
  },
  {
    key: "results_submitted",
    label: "Results submitted",
    color: "teal",
    statuses: ["results_submitted"],
  },
  {
    key: "completed",
    label: "Completed",
    color: "green",
    statuses: ["completed", "closed"],
  },
  {
    key: "cancelled",
    label: "Cancelled",
    color: "red",
    statuses: ["cancelled", "canceled"],
  },
];

const OTHER_LANE: Lane = { key: "other", label: "Other", color: "gray", statuses: [] };

function laneFor(status: string): Lane {
  const normalized = status.toLowerCase();
  return LANES.find((lane) => lane.statuses.includes(normalized)) ?? OTHER_LANE;
}

export function MyExperimentsBoard({
  experiments,
}: {
  experiments: MyExperiment[];
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return experiments;
    return experiments.filter((exp) =>
      [exp.experimentTitle, exp.sampleType, exp.contextId].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [experiments, query]);

  const lanes = useMemo(() => {
    const buckets = new Map<string, MyExperiment[]>();
    for (const exp of visible) {
      const lane = laneFor(exp.status);
      const items = buckets.get(lane.key);
      if (items) items.push(exp);
      else buckets.set(lane.key, [exp]);
    }
    // Always show the full lifecycle pipeline so the board structure is stable;
    // the catch-all "Other" column only appears when something lands in it.
    const columns: Lane[] = [...LANES];
    if (buckets.get(OTHER_LANE.key)?.length) columns.push(OTHER_LANE);
    return columns.map((lane) => ({
      lane,
      items: buckets.get(lane.key) ?? [],
    }));
  }, [visible]);

  if (experiments.length === 0) {
    return (
      <Stack gap="md" align="flex-start">
        <Text c="dimmed">You haven&apos;t requested any experiments yet.</Text>
        <LinkButton href={requestCatalogPath()}>
          Request your first experiment
        </LinkButton>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput
          placeholder="Search experiment, specimen, or context ID…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={340}
          aria-label="Search experiments"
        />
        <Text size="sm" c="dimmed">
          {visible.length} of {experiments.length} experiment
          {experiments.length === 1 ? "" : "s"}
        </Text>
      </Group>

      <Box
        style={{
          display: "flex",
          gap: "var(--mantine-spacing-md)",
          overflowX: "auto",
          alignItems: "flex-start",
          paddingBottom: "var(--mantine-spacing-sm)",
        }}
      >
        {lanes.map(({ lane, items }) => (
          <Paper
            key={lane.key}
            withBorder
            radius="md"
            p="sm"
            style={{
              flex: "0 0 280px",
              minWidth: 280,
              backgroundColor: "var(--mantine-color-default-hover)",
            }}
          >
            <Group justify="space-between" align="center" mb="sm" px={4}>
              <Text size="sm" fw={600}>
                {lane.label}
              </Text>
              <Badge size="sm" variant="light" color={lane.color} circle>
                {items.length}
              </Badge>
            </Group>
            <Stack gap="sm">
              {items.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  None
                </Text>
              ) : (
                items.map((exp) => (
                  <ExperimentCard key={exp.contextId} experiment={exp} />
                ))
              )}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

function ExperimentCard({ experiment }: { experiment: MyExperiment }) {
  const meta = statusMeta(experiment.status);
  return (
    <Card
      component={Link}
      href={myExperimentDetailPath(experiment.contextId)}
      withBorder
      radius="md"
      padding="md"
      style={{ cursor: "pointer" }}
    >
      <Stack gap="xs">
        <Text size="sm" fw={500} lineClamp={2}>
          {experiment.experimentTitle ?? "Untitled experiment"}
        </Text>
        <Group gap="xs">
          {experiment.sampleType && (
            <Badge size="xs" variant="light" color="grape" radius="sm">
              {experiment.sampleType}
            </Badge>
          )}
          <Badge size="xs" variant="light" color={meta.color} radius="sm">
            {meta.label}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Updated {formatDateTime(experiment.updatedAt)}
        </Text>
      </Stack>
    </Card>
  );
}
