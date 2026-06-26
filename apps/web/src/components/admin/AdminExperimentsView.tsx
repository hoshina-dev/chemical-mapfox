"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import classes from "@/components/admin/staffListing.module.css";
import { CopyableId } from "@/components/internal/CopyableId";
import { LocalDateTime } from "@/components/LocalDateTime";
import { UserAvatar } from "@/components/UserAvatar";
import {
  experimentRawPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import type { EnrichedTicket } from "@/lib/internal/experiments";
import { statusMeta } from "@/lib/ticketing/tickets";

type SortField = "experiment" | "requester" | "status" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";
type Group = "all" | "active" | "pending" | "done";

const PENDING_STATUSES = ["requested", "open", "pending", "sample_received"];
const ACTIVE_STATUSES = ["experimenting", "experiment_started", "in_progress", "finalizing"];
const DONE_STATUSES = [
  "results_submitted",
  "completed",
  "closed",
  "cancelled",
  "canceled",
];

const DEFAULT_COLORS = { bg: "#f1f3f5", fg: "#495057", dot: "#adb5bd" };

const COLOR_PALETTE: Record<string, { bg: string; fg: string; dot: string }> = {
  blue: { bg: "#e7f5ff", fg: "#1864ab", dot: "#339af0" },
  gray: DEFAULT_COLORS,
  cyan: { bg: "#e3fafc", fg: "#0b7285", dot: "#22b8cf" },
  yellow: { bg: "#fff4e6", fg: "#c04a00", dot: "#fd7e14" },
  teal: { bg: "#f3fbe8", fg: "#2b6b10", dot: "#74c214" },
  green: { bg: "#ebfbee", fg: "#1a6b2a", dot: "#40c057" },
  red: { bg: "#fff5f5", fg: "#c92a2a", dot: "#fa5252" },
};

const GROUP_FILTERS: {
  group: Group;
  label: string;
  hint: string;
  accent: string;
  bg: string;
}[] = [
  {
    group: "all",
    label: "All",
    hint: "Every experiment ticket",
    accent: "#343a40",
    bg: "#f8f9fa",
  },
  {
    group: "active",
    label: "Active",
    hint: "In progress · Finalizing",
    accent: "#1864ab",
    bg: "#e7f5ff",
  },
  {
    group: "pending",
    label: "Pending",
    hint: "Requested · Sample received",
    accent: "#c04a00",
    bg: "#fff4e6",
  },
  {
    group: "done",
    label: "Closed",
    hint: "Completed · Cancelled",
    accent: "#1a6b2a",
    bg: "#ebfbee",
  },
];

function colorsFor(mantineColor: string): { bg: string; fg: string; dot: string } {
  return COLOR_PALETTE[mantineColor] ?? DEFAULT_COLORS;
}

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

function groupOf(status: string): Group {
  const s = status.toLowerCase();
  if (ACTIVE_STATUSES.includes(s)) return "active";
  if (PENDING_STATUSES.includes(s)) return "pending";
  if (DONE_STATUSES.includes(s)) return "done";
  return "all";
}

const SORTABLE: { field: SortField; label: string }[] = [
  { field: "experiment", label: "Experiment" },
  { field: "requester", label: "Requester" },
  { field: "status", label: "Status" },
  { field: "createdAt", label: "Created" },
  { field: "updatedAt", label: "Updated" },
];

export function AdminExperimentsView({ tickets }: { tickets: EnrichedTicket[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group>("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const counts = useMemo(() => {
    const result: Record<Group, number> = { all: tickets.length, active: 0, pending: 0, done: 0 };
    for (const t of tickets) {
      const g = groupOf(t.status);
      if (g !== "all") result[g]++;
    }
    return result;
  }, [tickets]);

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
      if (statusFilter) {
        if (t.status !== statusFilter) return false;
      } else if (activeGroup !== "all" && groupOf(t.status) !== activeGroup) {
        return false;
      }
      if (!q) return true;
      return [t.contextId, t.experimentTitle, t.sampleType, t.requester?.email, t.requester?.name].some(
        (v) => v?.toLowerCase().includes(q),
      );
    });
    const sorted = [...filtered].sort((a, b) =>
      sortKey(a, sortField).localeCompare(sortKey(b, sortField)),
    );
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [tickets, query, statusFilter, activeGroup, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function selectGroup(group: Group) {
    setActiveGroup(group);
    setStatusFilter(null);
  }

  function selectStatus(status: string | null) {
    setStatusFilter(status);
    setActiveGroup("all");
  }

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <h1 className={classes.title}>Experiments</h1>
        <p className={classes.subtitle}>
          Every experiment ticket from the ticketing service. Filter by lifecycle group,
          search, sort, and open a row to work the experiment.
        </p>
      </header>

      <div className={classes.groupFilters} role="group" aria-label="Filter by lifecycle group">
        {GROUP_FILTERS.map((filter) => {
          const active = statusFilter === null && activeGroup === filter.group;
          const filterStyle = active
            ? ({
                "--filter-accent": filter.accent,
                "--filter-bg": filter.bg,
              } as CSSProperties)
            : undefined;

          return (
            <button
              key={filter.group}
              type="button"
              className={`${classes.groupFilter}${active ? ` ${classes.groupFilterActive}` : ""}`}
              style={filterStyle}
              aria-pressed={active}
              onClick={() => selectGroup(filter.group)}
            >
              <span className={classes.groupFilterLabel}>{filter.label}</span>
              <div className={classes.groupFilterRow}>
                <span className={classes.groupFilterCount}>{counts[filter.group]}</span>
              </div>
              <span className={classes.groupFilterHint}>{filter.hint}</span>
            </button>
          );
        })}
      </div>

      <div className={classes.panel}>
        <div className={classes.toolbar}>
          <input
            className={classes.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experiments, requesters…"
            aria-label="Search experiments"
          />
          <div className={classes.statusPills}>
            <button
              type="button"
              className={`${classes.statusPill}${statusFilter === null && activeGroup === "all" ? ` ${classes.statusPillActive}` : ""}`}
              onClick={() => selectStatus(null)}
            >
              All statuses
            </button>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${classes.statusPill}${statusFilter === opt.value ? ` ${classes.statusPillActive}` : ""}`}
                onClick={() => selectStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className={classes.resultCount}>
            {visible.length} of {tickets.length} experiment{tickets.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={classes.tableWrap}>
          <table className={classes.table}>
            <thead className={classes.thead}>
              <tr>
                {SORTABLE.map(({ field, label }) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={`${classes.th}${sortField === field ? ` ${classes.thSorted}` : ""}`}
                  >
                    {label}{" "}
                    <span aria-hidden style={{ opacity: sortField === field ? 1 : 0.4, fontSize: 10 }}>
                      {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </th>
                ))}
                <th className={classes.th}>Context ID</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ticket) => {
                const meta = statusMeta(ticket.status);
                const colors = colorsFor(meta.color);

                return (
                  <tr
                    key={ticket.contextId}
                    className={classes.row}
                    onClick={() => router.push(experimentWorkspacePath(ticket.contextId))}
                  >
                    <td style={{ padding: 0, position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          background: colors.dot,
                        }}
                      />
                      <div style={{ padding: "12px 14px 12px 20px" }}>
                        <div style={{ fontWeight: 600, fontSize: "13.5px", marginBottom: 4 }}>
                          {ticket.experimentTitle ?? "Untitled experiment"}
                        </div>
                        {ticket.sampleType && (
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "1px 7px",
                              borderRadius: 3,
                              fontSize: 11,
                              fontWeight: 500,
                              background: "#f1f3f5",
                              color: "#495057",
                            }}
                          >
                            {ticket.sampleType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {ticket.requester ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <UserAvatar
                            name={ticket.requester.name}
                            email={ticket.requester.email}
                            avatarUrl={ticket.requester.avatarUrl}
                            size={30}
                            radius="xl"
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>
                              {ticket.requester.name ?? ticket.requester.email ?? "—"}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#868e96" }}>
                              {ticket.requester.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "#868e96" }}>{ticket.userId ?? "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 9px 3px 7px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: ".04em",
                          whiteSpace: "nowrap",
                          background: colors.bg,
                          color: colors.fg,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: colors.dot,
                          }}
                        />
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13 }}>
                      <LocalDateTime iso={ticket.createdAt} />
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13 }}>
                      <LocalDateTime iso={ticket.updatedAt} />
                    </td>
                    <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <CopyableId
                        value={ticket.contextId}
                        size="xs"
                        href={experimentRawPath(ticket.contextId)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className={classes.empty}>
            <div className={classes.emptyTitle}>No experiments found</div>
            <div className={classes.emptyHint}>
              {tickets.length === 0
                ? "No experiments yet."
                : "Try adjusting your search or filter."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
