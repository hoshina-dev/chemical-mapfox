"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

// Badge palette keyed by the Mantine color name statusMeta() already returns,
// so a new status only needs an entry in STATUS_META to pick up a look here.
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

const BANNERS: { group: Group; label: string; sub: string; bg: string }[] = [
  { group: "all", label: "Total", sub: "All experiments", bg: "#1c2128" },
  { group: "active", label: "Active", sub: "In progress · Finalizing", bg: "#1864ab" },
  {
    group: "pending",
    label: "Pending",
    sub: "Requested · Open · Sample received",
    bg: "#c94a00",
  },
  {
    group: "done",
    label: "Closed",
    sub: "Results submitted · Closed · Cancelled",
    bg: "#1a6b2a",
  },
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
    const sorted = [...filtered].sort((a, b) => sortKey(a, sortField).localeCompare(sortKey(b, sortField)));
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
    <div>
      {/* Stats banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        {BANNERS.map((b) => {
          const active = statusFilter === null && activeGroup === b.group;
          return (
            <button
              key={b.group}
              type="button"
              onClick={() => selectGroup(b.group)}
              style={{
                padding: "28px 32px",
                cursor: "pointer",
                border: "none",
                textAlign: "left",
                background: b.bg,
                boxShadow: active ? "inset 0 -3px 0 rgba(255,255,255,.5)" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  color: "rgba(255,255,255,.55)",
                  marginBottom: 2,
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 900,
                  color: "#fff",
                  lineHeight: 1,
                  letterSpacing: "-3px",
                  marginBottom: 6,
                }}
              >
                {counts[b.group]}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{b.sub}</div>
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 56px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 3 }}>
            Experiments
          </h1>
          <p style={{ fontSize: "13.5px", color: "#868e96" }}>
            Every experiment ticket from the ticketing service. Search, sort by any column, and
            open one to start working.
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #dee2e6",
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
            overflow: "hidden",
          }}
        >
          {/* Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 16px",
              borderBottom: "1px solid #e9ecef",
              flexWrap: "wrap",
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search experiments, requesters…"
              aria-label="Search experiments"
              style={{
                flex: 1,
                minWidth: 200,
                maxWidth: 340,
                height: 34,
                padding: "0 10px",
                border: "1px solid #dee2e6",
                borderRadius: 5,
                fontSize: "13.5px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => selectStatus(null)}
                style={pillStyle(statusFilter === null)}
              >
                All
              </button>
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectStatus(opt.value)}
                  style={pillStyle(statusFilter === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", fontSize: "12.5px", color: "#868e96", whiteSpace: "nowrap" }}>
              {visible.length} of {tickets.length} experiment{tickets.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  {SORTABLE.map(({ field, label }) => (
                    <th
                      key={field}
                      onClick={() => toggleSort(field)}
                      style={thStyle(sortField === field)}
                    >
                      {label}{" "}
                      <i style={{ opacity: sortField === field ? 1 : 0.4, fontSize: 10, fontStyle: "normal" }}>
                        {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </i>
                    </th>
                  ))}
                  <th style={thStyle(false)}>Context ID</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((ticket) => {
                  const meta = statusMeta(ticket.status);
                  const colors = colorsFor(meta.color);

                  return (
                    <tr
                      key={ticket.contextId}
                      onClick={() => router.push(experimentWorkspacePath(ticket.contextId))}
                      style={{ borderBottom: "1px solid #e9ecef", cursor: "pointer" }}
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
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#495057", marginBottom: 4 }}>
                No experiments found
              </div>
              <div style={{ fontSize: 13, color: "#868e96" }}>
                {tickets.length === 0 ? "No experiments yet." : "Try adjusting your search or filter."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    height: 30,
    padding: "0 12px",
    border: "1px solid",
    borderColor: active ? "#111318" : "#dee2e6",
    borderRadius: 20,
    fontSize: "12.5px",
    fontWeight: 500,
    color: active ? "#fff" : "#495057",
    background: active ? "#111318" : "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function thStyle(sorted: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: sorted ? "#212529" : "#868e96",
    borderBottom: "1px solid #dee2e6",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  };
}
