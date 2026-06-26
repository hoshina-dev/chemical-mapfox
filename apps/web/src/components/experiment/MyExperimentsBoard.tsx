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

import { StatusChip } from "@/components/ticketing/StatusChip";
import { LinkButton } from "@/components/links";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { MyExperiment } from "@/lib/experiment/data";
import { myExperimentDetailPath, requestCatalogPath } from "@/lib/experiment/routes";

interface Lane {
  key: string;
  label: string;
  /** Mantine color for the column's count badge accent. */
  color: string;
  statuses: string[];
}

// Lifecycle lanes for the Kanban, in flow order. Statuses are the canonical
// ticketing enum (REQUESTED → PENDING → EXPERIMENTING → FINALIZING → CLOSED,
// lowercased); legacy/frontend-only keys are kept as harmless fallbacks. Note
// PENDING is the "Sample received" stage — it must not fall into Requested.
const PIPELINE_LANES: Lane[] = [
  {
    key: "requested",
    label: "Requested",
    color: "blue",
    statuses: ["requested", "open"],
  },
  {
    key: "sample_received",
    label: "Sample received",
    color: "cyan",
    statuses: ["pending", "sample_received"],
  },
  {
    key: "in_progress",
    label: "In progress",
    color: "yellow",
    statuses: ["experimenting", "experiment_started", "in_progress"],
  },
  {
    key: "finalizing",
    label: "Finalizing",
    color: "teal",
    statuses: ["finalizing", "results_submitted"],
  },
  {
    key: "closed",
    label: "Closed",
    color: "green",
    statuses: ["closed", "completed"],
  },
];

// Cancelled and the catch-all "Other" are only shown when something lands in
// them, so the default board is the clean 5-stage pipeline that fits a wide
// screen without horizontal scrolling.
const CANCELLED_LANE: Lane = {
  key: "cancelled",
  label: "Cancelled",
  color: "red",
  statuses: ["cancelled", "canceled"],
};
const OTHER_LANE: Lane = { key: "other", label: "Other", color: "gray", statuses: [] };

const LANE_LOOKUP: Lane[] = [...PIPELINE_LANES, CANCELLED_LANE];

function laneFor(status: string): Lane {
  const normalized = status.toLowerCase();
  return (
    LANE_LOOKUP.find((lane) => lane.statuses.includes(normalized)) ?? OTHER_LANE
  );
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
      [exp.name, exp.contextId].some((v) =>
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
    // Cancelled and the catch-all "Other" columns only appear when populated.
    const columns: Lane[] = [...PIPELINE_LANES];
    if (buckets.get(CANCELLED_LANE.key)?.length) columns.push(CANCELLED_LANE);
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
          placeholder="Search experiment or context ID…"
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
              // Grow to share the row equally on wide screens (no scroll for
              // the 5-stage pipeline); `minWidth` keeps columns readable and
              // lets the row scroll horizontally only when it genuinely can't
              // fit (narrow screens or extra Cancelled/Other lanes).
              flex: "1 1 0",
              minWidth: 240,
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
          {experiment.name ?? "Untitled experiment"}
        </Text>
        <Group gap="xs">
          <StatusChip status={experiment.status} variant="badge" size="xs" />
        </Group>
        <Text size="xs" c="dimmed">
          Updated <LocalDateTime iso={experiment.updatedAt} />
        </Text>
      </Stack>
    </Card>
  );
}
