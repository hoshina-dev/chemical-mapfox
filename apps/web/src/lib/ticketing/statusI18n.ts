/**
 * Maps raw ticketing-service status strings to keys in the `status` message
 * namespace (messages/*.json). Unknown statuses return null so callers can fall
 * back to a humanized label.
 */
export type StatusMessageKey =
  | "requested"
  | "open"
  | "sampleReceived"
  | "inProgress"
  | "finalizing"
  | "resultsSubmitted"
  | "completed"
  | "closed"
  | "cancelled";

const STATUS_TRANSLATION_KEY: Record<string, StatusMessageKey> = {
  requested: "requested",
  open: "open",
  pending: "sampleReceived",
  sample_received: "sampleReceived",
  experimenting: "inProgress",
  finalizing: "finalizing",
  experiment_started: "inProgress",
  in_progress: "inProgress",
  results_submitted: "resultsSubmitted",
  completed: "completed",
  closed: "closed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

export function statusTranslationKey(
  status: string,
): StatusMessageKey | null {
  return STATUS_TRANSLATION_KEY[status.toLowerCase()] ?? null;
}
