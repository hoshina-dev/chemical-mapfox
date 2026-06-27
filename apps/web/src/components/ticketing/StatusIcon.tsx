/** Semantic lifecycle stage for icon lookup (many raw statuses map to one icon). */
export type StatusIconKind =
  | "requested"
  | "open"
  | "sample_received"
  | "in_progress"
  | "finalizing"
  | "completed"
  | "cancelled"
  | "unknown";

export function statusIconKind(status: string): StatusIconKind {
  const s = status.toLowerCase();
  if (s === "requested") return "requested";
  if (s === "open") return "open";
  if (s === "pending" || s === "sample_received") return "sample_received";
  if (s === "experimenting" || s === "experiment_started" || s === "in_progress") {
    return "in_progress";
  }
  if (s === "finalizing" || s === "results_submitted") return "finalizing";
  if (s === "completed" || s === "closed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "unknown";
}

/** Inline SVG icon for a ticket lifecycle status (no external icon library). */
export function StatusIcon({
  kind,
  size = 12,
  className,
}: {
  kind: StatusIconKind;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  switch (kind) {
    case "requested":
      return (
        <svg {...common}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case "open":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "sample_received":
      return (
        <svg {...common}>
          <path d="M12 22V12" />
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 7v10l9 4 9-4V7" />
        </svg>
      );
    case "in_progress":
      return (
        <svg {...common}>
          <path d="M10 2v6.5a2 2 0 0 1-.2.9L5 20.5a1 1 0 0 0 .9 1.5h12.2a1 1 0 0 0 .9-1.5L14.2 9.4a2 2 0 0 1-.2-.9V2" />
          <path d="M8.5 2h7" />
        </svg>
      );
    case "finalizing":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case "completed":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "cancelled":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15 9-6 6M9 9l6 6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
  }
}
