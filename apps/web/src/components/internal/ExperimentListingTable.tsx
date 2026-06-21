"use client";

import {
  Avatar,
  Badge,
  Box,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CopyableId } from "@/components/internal/CopyableId";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  experimentRawPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import type { EnrichedTicket } from "@/lib/internal/experiments";
import { statusMeta } from "@/lib/ticketing/tickets";

type SortField = "experiment" | "requester" | "status" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";

const SORTABLE: { field: SortField; label: string }[] = [
  { field: "experiment", label: "Experiment" },
  { field: "requester", label: "Requester" },
  { field: "status", label: "Status" },
  { field: "createdAt", label: "Created" },
  { field: "updatedAt", label: "Updated" },
];

function sortKey(ticket: EnrichedTicket, field: SortField): string {
  switch (field) {
    case "experiment":
      return ticket.experimentTitle ?? ticket.sampleType ?? "";
    case "requester":
      return ticket.requester?.email ?? ticket.requester?.name ?? "";
    case "status":
      return statusMeta(ticket.status).label;
    case "createdAt":
      return ticket.createdAt ?? "";
    case "updatedAt":
      return ticket.updatedAt ?? "";
  }
}

function initials(requester: { name: string | null; email: string | null }): string {
  const source = requester.name ?? requester.email ?? "";
  return source.slice(0, 2).toUpperCase();
}

export function ExperimentListingTable({
  tickets,
}: {
  tickets: EnrichedTicket[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tickets) {
      if (!seen.has(t.status)) seen.set(t.status, statusMeta(t.status).label);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [tickets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return [
        t.contextId,
        t.experimentTitle,
        t.sampleType,
        t.requester?.email,
        t.requester?.name,
      ].some((v) => v?.toLowerCase().includes(q));
    });
    const sorted = [...filtered].sort((a, b) =>
      sortKey(a, sortField).localeCompare(sortKey(b, sortField)),
    );
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [tickets, query, statusFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search context ID, experiment, requester…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            w={320}
            aria-label="Search experiments"
          />
          <Select
            placeholder="All statuses"
            data={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={200}
            aria-label="Filter by status"
          />
        </Group>
        <Text size="sm" c="dimmed">
          {visible.length} of {tickets.length} experiment
          {tickets.length === 1 ? "" : "s"}
        </Text>
      </Group>

      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
          <TableThead>
            <TableTr>
              {SORTABLE.map(({ field, label }) => (
                <TableTh key={field}>
                  <SortHeader
                    label={label}
                    active={sortField === field}
                    dir={sortDir}
                    onClick={() => toggleSort(field)}
                  />
                </TableTh>
              ))}
              <TableTh>Context ID</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {visible.map((ticket) => {
              const meta = statusMeta(ticket.status);
              return (
                <TableTr
                  key={ticket.contextId}
                  onClick={() =>
                    router.push(experimentWorkspacePath(ticket.contextId))
                  }
                  style={{ cursor: "pointer" }}
                >
                  <TableTd>
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>
                        {ticket.experimentTitle ?? "Untitled experiment"}
                      </Text>
                      {ticket.sampleType && (
                        <Badge
                          size="xs"
                          variant="light"
                          color="grape"
                          radius="sm"
                        >
                          {ticket.sampleType}
                        </Badge>
                      )}
                    </Stack>
                  </TableTd>
                  <TableTd>
                    {ticket.requester ? (
                      <Group gap="xs" wrap="nowrap">
                        <Avatar
                          src={ticket.requester.avatarUrl}
                          alt={ticket.requester.name ?? ""}
                          radius="xl"
                          size="sm"
                        >
                          {initials(ticket.requester)}
                        </Avatar>
                        <Text size="sm">
                          {ticket.requester.email ??
                            ticket.requester.name ??
                            "—"}
                        </Text>
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {ticket.userId ?? "—"}
                      </Text>
                    )}
                  </TableTd>
                  <TableTd>
                    <Badge color={meta.color} variant="light" radius="sm">
                      {meta.label}
                    </Badge>
                  </TableTd>
                  <TableTd>
                    <Text size="sm" c="dimmed">
                      <LocalDateTime iso={ticket.createdAt} />
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Text size="sm" c="dimmed">
                      <LocalDateTime iso={ticket.updatedAt} />
                    </Text>
                  </TableTd>
                  <TableTd onClick={(e) => e.stopPropagation()}>
                    <CopyableId
                      value={ticket.contextId}
                      size="xs"
                      href={experimentRawPath(ticket.contextId)}
                    />
                  </TableTd>
                </TableTr>
              );
            })}
          </TableTbody>
        </Table>
        {visible.length === 0 && (
          <Box p="xl">
            <Text c="dimmed" ta="center" size="sm">
              {tickets.length === 0
                ? "No experiments yet."
                : "No experiments match your search."}
            </Text>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} style={{ width: "100%" }}>
      <Group gap={4} wrap="nowrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Text size="xs" c={active ? "blue" : "dimmed"} aria-hidden>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
