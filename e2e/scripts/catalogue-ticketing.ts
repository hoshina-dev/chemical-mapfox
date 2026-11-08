import { randomUUID } from "node:crypto";

import { registerStub } from "../features/support/stub/registry.js";
import type { StubContext } from "../features/support/stub/types.js";

/**
 * One complete ticketing-service double for the local catalogue stack, so a
 * request made in the client UI can be listed, checked in, started, submitted
 * and closed against the real experiment-manager. Lives outside
 * `stub/modules/` so the Cucumber suite (whose feature modules each own a
 * slice of the ticket API) never loads it.
 */

const NEXT_STATUS: Record<string, string> = {
  REQUESTED: "PENDING",
  PENDING: "EXPERIMENTING",
  EXPERIMENTING: "FINALIZING",
  FINALIZING: "CLOSED",
};

const TIMESTAMP_FIELD: Record<string, string> = {
  PENDING: "sample_received_at",
  EXPERIMENTING: "experiment_started_at",
  FINALIZING: "results_submitted_at",
  CLOSED: "closed_at",
};

type Ticket = Record<string, unknown> & {
  id: string;
  status: string;
  user_id: string | null;
  organization_id: string | null;
  updated_at: string;
};

const tickets = new Map<string, Ticket>();

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path, url } = ctx;
  if (path[0] !== "tickets") return false;

  if (path.length === 1 && method === "POST") {
    const body = (await ctx.readBody()) as Record<string, string | undefined>;
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: randomUUID(),
      name: body.name ?? null,
      status: "REQUESTED",
      organization_id: body.organization_id ?? null,
      user_id: body.user_id ?? null,
      experiment_template: body.experiment_template_id
        ? { experiment_template_id: body.experiment_template_id }
        : undefined,
      created_at: now,
      updated_at: now,
      sample_received_at: null,
      experiment_started_at: null,
      results_submitted_at: null,
      closed_at: null,
      closed_reason: null,
    };
    tickets.set(ticket.id, ticket);
    return ctx.json(201, ticket);
  }

  if (path.length === 1 && method === "GET") {
    const userId = url.searchParams.get("user_id");
    const orgId = url.searchParams.get("organization_id");
    const status = url.searchParams.get("status");
    const rows = [...tickets.values()]
      .filter((t) => !userId || t.user_id === userId)
      .filter((t) => !orgId || t.organization_id === orgId)
      .filter((t) => !status || t.status === status)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return ctx.json(200, rows);
  }

  const ticket = tickets.get(decodeURIComponent(path[1] ?? ""));
  if (!ticket) return ctx.json(404, { error: "ticket not found" });

  if (path.length === 2 && method === "GET") return ctx.json(200, ticket);

  if (path.length === 3 && path[2] === "status" && method === "PATCH") {
    const { status } = (await ctx.readBody()) as { status?: string };
    if (!status || NEXT_STATUS[ticket.status] !== status) {
      return ctx.json(422, {
        error: `Invalid transition: a ${ticket.status} ticket cannot move to ${status}.`,
      });
    }
    const now = new Date().toISOString();
    ticket.status = status;
    ticket[TIMESTAMP_FIELD[status]] = now;
    ticket.updated_at = now;
    return ctx.json(200, ticket);
  }

  return false;
}

registerStub({
  name: "catalogue-ticketing",
  priority: 100,
  reset: () => tickets.clear(),
  handle,
});
