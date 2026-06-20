import type { TicketingTicketResponse } from "@repo/api-client";

/**
 * View model for an experiment ticket. A ticket's `id` is the experiment
 * **context id** used to address the experiment everywhere else in the app.
 */
export interface ExperimentTicket {
  contextId: string;
  status: string;
  templateId: string | null;
  organizationId: string | null;
  userId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sampleReceivedAt: string | null;
  experimentStartedAt: string | null;
  resultsSubmittedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
}

export function toExperimentTicket(
  ticket: TicketingTicketResponse,
): ExperimentTicket {
  return {
    contextId: ticket.id ?? "",
    status: ticket.status ?? "unknown",
    templateId: ticket.experimentTemplate?.experimentTemplateId ?? null,
    organizationId: ticket.organizationId ?? null,
    userId: ticket.userId ?? null,
    createdAt: ticket.createdAt ?? null,
    updatedAt: ticket.updatedAt ?? null,
    sampleReceivedAt: ticket.sampleReceivedAt ?? null,
    experimentStartedAt: ticket.experimentStartedAt ?? null,
    resultsSubmittedAt: ticket.resultsSubmittedAt ?? null,
    closedAt: ticket.closedAt ?? null,
    closedReason: ticket.closedReason ?? null,
  };
}

export interface StatusMeta {
  label: string;
  /** Mantine color name used for the status Badge. */
  color: string;
}

// Known ticket lifecycle statuses → display label + colour. Unknown statuses
// fall back to a humanised label in grey, so the table never breaks if the
// backend introduces a new status.
const STATUS_META: Record<string, StatusMeta> = {
  open: { label: "Open", color: "gray" },
  pending: { label: "Pending", color: "gray" },
  sample_received: { label: "Sample received", color: "blue" },
  experiment_started: { label: "In progress", color: "yellow" },
  in_progress: { label: "In progress", color: "yellow" },
  results_submitted: { label: "Results submitted", color: "teal" },
  completed: { label: "Completed", color: "green" },
  closed: { label: "Closed", color: "green" },
  cancelled: { label: "Cancelled", color: "red" },
  canceled: { label: "Cancelled", color: "red" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status.toLowerCase()] ?? { label: humanize(status), color: "gray" };
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Deterministic `YYYY-MM-DD HH:mm` from an ISO timestamp. Avoids `new Date()`
 * locale formatting so server and client render identically (no hydration
 * mismatch). Returns "—" for missing values.
 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return time ? `${date} ${time}` : date;
}
