/**
 * View model of a ticket (one sample) for the listings and detail pages.
 * `contextId` is the ticket id.
 */
export interface ExperimentTicket {
  contextId: string;
  name: string | null;
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

export interface StatusMeta {
  label: string;
  /** Mantine color name used for the status Badge. */
  color: string;
}

// Known ticket lifecycle statuses → display label + colour. Unknown statuses
// fall back to a humanised label in grey, so the table never breaks if the
// backend introduces a new status.
const STATUS_META: Record<string, StatusMeta> = {
  // Statuses come as SCREAMING_SNAKE_CASE; keys here are lowercase because
  // statusMeta() lowercases before lookup.
  requested: { label: "Requested", color: "blue" },
  open: { label: "Open", color: "gray" },
  received: { label: "Sample received", color: "cyan" },
  pending: { label: "Sample received", color: "cyan" },
  sample_received: { label: "Sample received", color: "cyan" },
  // sample_tracker: REQUESTED → RECEIVED → IN_PROGRESS → COMPLETED → CLOSED
  // (or CANCELLED); the others are older names, kept so old data still reads.
  experimenting: { label: "In progress", color: "yellow" },
  finalizing: { label: "Finalizing", color: "teal" },
  experiment_started: { label: "In progress", color: "yellow" },
  in_progress: { label: "In progress", color: "yellow" },
  results_submitted: { label: "Results submitted", color: "teal" },
  completed: { label: "Completed", color: "teal" },
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
