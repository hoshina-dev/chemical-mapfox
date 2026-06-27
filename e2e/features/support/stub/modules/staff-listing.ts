import { findUserByEmail } from "../../fixtures.js";
import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Backend stub for the staff experiment listing + raw view feature.
 *
 *  - ticketing-service: `GET /api/v1/tickets` (list) and
 *    `GET /api/v1/tickets/{id}` (single) — the staff listing and the raw view
 *    read tickets from here. Requester info is joined by the BFF from custapi
 *    (already stubbed) via each ticket's `user_id`.
 *  - experiment-manager: `GET /api/experiments/{id}` — the raw view shows this
 *    JSON alongside the ticket JSON. (The experiment-manager base path is *not*
 *    `/api/v1`, so it isn't stripped: the segments arrive as
 *    `["api", "experiments", id]`.)
 *
 * State is feature-local and reset before each scenario; step definitions seed
 * it through the exported helpers.
 */

const ISO = (value: string): string => new Date(value).toISOString();

interface StoredTicket {
  id: string;
  name: string;
  status: string;
  userId: string | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeedTicketInput {
  /** Context id (a.k.a. ticket id). Auto-generated when omitted. */
  id?: string;
  name: string;
  status: string;
  /** Email of a seeded user; resolved to that user's id for the join. */
  requesterEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

const tickets: StoredTicket[] = [];
const experiments = new Map<string, unknown>();
let seq = 0;

export function addTicket(input: SeedTicketInput): StoredTicket {
  seq += 1;
  const requester = input.requesterEmail
    ? findUserByEmail(input.requesterEmail)
    : undefined;
  const ticket: StoredTicket = {
    id: input.id ?? `ctx-${seq}`,
    name: input.name,
    status: input.status,
    userId: requester?.id ?? null,
    organizationId: requester?.organizationIds[0] ?? null,
    createdAt: ISO(input.createdAt ?? "2025-01-01T00:00:00Z"),
    updatedAt: ISO(input.updatedAt ?? input.createdAt ?? "2025-01-01T00:00:00Z"),
  };
  tickets.push(ticket);
  return ticket;
}

/** Seed the experiment-manager record the raw view shows for a context id. */
export function addExperimentRecord(contextId: string, data: unknown): void {
  experiments.set(contextId, data);
}

function ticketWire(ticket: StoredTicket) {
  return {
    id: ticket.id,
    name: ticket.name,
    status: ticket.status,
    user_id: ticket.userId ?? undefined,
    organization_id: ticket.organizationId ?? undefined,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  };
}

function reset(): void {
  tickets.length = 0;
  experiments.clear();
  seq = 0;
}

function handle(ctx: StubContext): boolean {
  const { method, path } = ctx;

  // ---- ticketing-service: tickets ---------------------------------------
  if (path[0] === "tickets" && method === "GET") {
    if (path.length === 1) {
      return ctx.json(200, tickets.map(ticketWire));
    }
    if (path[1]) {
      const id = decodeURIComponent(path[1]);
      const ticket = tickets.find((t) => t.id === id);
      if (!ticket) return ctx.json(404, { error: "ticket not found" });
      return ctx.json(200, ticketWire(ticket));
    }
  }

  // ---- experiment-manager: experiment context --------------------------
  if (
    path[0] === "api" &&
    path[1] === "experiments" &&
    path[2] &&
    method === "GET"
  ) {
    const id = decodeURIComponent(path[2]);
    if (!experiments.has(id)) {
      return ctx.json(404, { detail: "experiment not found" });
    }
    return ctx.json(200, experiments.get(id));
  }

  return false;
}

registerStub({ name: "staff-listing", reset, handle });
