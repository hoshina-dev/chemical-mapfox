import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Backend stub for the client "track experiments" feature.
 *
 * Models just enough of the **ticketing-service** for the client board +
 * read-only detail page:
 *   - GET /api/v1/tickets            → list (filtered by `user_id`)
 *   - GET /api/v1/tickets/{id}       → single ticket
 * plus a stub for **experiment-manager** `getExperiment`:
 *   - GET /api/experiments/{id}      → 404 (no experiment context created yet,
 *                                      so the detail page shows its friendly
 *                                      "no details yet" state).
 *
 * Tickets carry a lifecycle `status` (REQUESTED → PENDING → EXPERIMENTING →
 * FINALIZING → CLOSED) so the board groups them into the right lanes. State is
 * module-local and seeded from step definitions via `addTicket`; `reset()`
 * clears it between scenarios.
 */

export interface StubTicket {
  id: string;
  name: string | null;
  status: string;
  userId: string;
  organizationId?: string | null;
  templateId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sampleReceivedAt?: string | null;
  experimentStartedAt?: string | null;
  resultsSubmittedAt?: string | null;
  closedAt?: string | null;
  closedReason?: string | null;
}

const ISO = new Date("2025-01-01T00:00:00.000Z").toISOString();

const tickets: StubTicket[] = [];

/** Seed a ticket (called from step definitions, same process as the stub). */
export function addTicket(ticket: StubTicket): void {
  tickets.push(ticket);
}

function resetTickets(): void {
  tickets.length = 0;
}

/** ticketing-service TicketResponse wire shape (snake_case). */
function ticketWire(ticket: StubTicket) {
  return {
    id: ticket.id,
    name: ticket.name ?? null,
    status: ticket.status,
    user_id: ticket.userId,
    organization_id: ticket.organizationId ?? null,
    experiment_template: ticket.templateId
      ? { experiment_template_id: ticket.templateId }
      : undefined,
    created_at: ticket.createdAt ?? ISO,
    updated_at: ticket.updatedAt ?? ISO,
    sample_received_at: ticket.sampleReceivedAt ?? null,
    experiment_started_at: ticket.experimentStartedAt ?? null,
    results_submitted_at: ticket.resultsSubmittedAt ?? null,
    closed_at: ticket.closedAt ?? null,
    closed_reason: ticket.closedReason ?? null,
  };
}

function handle(ctx: StubContext): boolean {
  const { method, path, url } = ctx;

  // ---- ticketing-service ------------------------------------------------
  if (method === "GET" && path[0] === "tickets") {
    // GET /api/v1/tickets — list, optionally filtered by user_id, newest first
    // (the BFF requests sort_by=updated_at&sort_dir=desc).
    if (path.length === 1) {
      const userId = url.searchParams.get("user_id");
      const rows = (userId
        ? tickets.filter((t) => t.userId === userId)
        : [...tickets]
      ).sort((a, b) => (b.updatedAt ?? ISO).localeCompare(a.updatedAt ?? ISO));
      return ctx.json(200, rows.map(ticketWire));
    }
    // GET /api/v1/tickets/{id} — single ticket.
    if (path.length === 2) {
      const ticket = tickets.find((t) => t.id === decodeURIComponent(path[1]));
      if (!ticket) return ctx.json(404, { error: "ticket not found" });
      return ctx.json(200, ticketWire(ticket));
    }
  }

  // ---- experiment-manager: getExperiment --------------------------------
  // GET /api/experiments/{id}. No experiment context is created for these
  // tickets, so 404 — the detail page treats that as the expected "not created
  // yet" state and renders without experiment details.
  if (
    method === "GET" &&
    path[0] === "api" &&
    path[1] === "experiments" &&
    path.length === 3
  ) {
    return ctx.json(404, { detail: "experiment context not found" });
  }

  return false;
}

registerStub({ name: "client-tracking", handle, reset: resetTickets });
