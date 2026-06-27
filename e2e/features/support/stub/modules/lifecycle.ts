import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Staff experiment-lifecycle backend stub. Models the ticketing-service ticket
 * state machine plus just enough of experiment-manager for the workspace /
 * check-in pages to render and the FINALIZING close-guards to be driven.
 *
 * Both the Cucumber step definitions and this stub run in the same Node
 * process, so steps seed/inspect the in-memory store below directly (same
 * pattern as `fixtures.ts` ↔ the custapi module) — no HTTP round-trip needed.
 */

/** Canonical ticket lifecycle and its only valid forward transitions. */
const NEXT_STATUS: Record<string, string> = {
  REQUESTED: "PENDING",
  PENDING: "EXPERIMENTING",
  EXPERIMENTING: "FINALIZING",
  FINALIZING: "CLOSED",
};

interface LifecycleTicket {
  id: string;
  name: string | null;
  status: string;
  organizationId: string | null;
  userId: string | null;
  createdAt: string;
  sampleReceivedAt: string | null;
  experimentStartedAt: string | null;
  resultsSubmittedAt: string | null;
  closedAt: string | null;
}

interface LifecycleCalculation {
  formula: string;
  result?: number | string;
}

interface LifecycleExperiment {
  id: string;
  sampleId: string;
  templateId: string;
  reportStatus: string | null;
  reportGeneratedAt: string | null;
  createdAt: string;
  calculations: Record<string, LifecycleCalculation>;
  values: Record<string, unknown>;
}

interface Store {
  tickets: Map<string, LifecycleTicket>;
  experiments: Map<string, LifecycleExperiment>;
  /** Tickets whose next status PATCH the backend guard refuses (→ 422). */
  guarded: Set<string>;
}

const store: Store = {
  tickets: new Map(),
  experiments: new Map(),
  guarded: new Set(),
};

const ISO = () => new Date().toISOString();

// --- Seeding / inspection helpers (used by the step definitions) -----------

export interface SeedOptions {
  contextId: string;
  status: string;
  name?: string;
}

/** Seed a ticket and its experiment-manager context at a given lifecycle stage. */
export function seedExperiment({ contextId, status, name }: SeedOptions): void {
  const now = ISO();
  store.tickets.set(contextId, {
    id: contextId,
    name: name ?? "Coal Proximate Analysis",
    status,
    organizationId: "org-1",
    userId: null,
    createdAt: now,
    sampleReceivedAt: reached(status, "PENDING") ? now : null,
    experimentStartedAt: reached(status, "EXPERIMENTING") ? now : null,
    resultsSubmittedAt: reached(status, "FINALIZING") ? now : null,
    closedAt: reached(status, "CLOSED") ? now : null,
  });
  store.experiments.set(contextId, {
    id: contextId,
    sampleId: "sample-1",
    templateId: "template-1",
    reportStatus: null,
    reportGeneratedAt: null,
    createdAt: now,
    calculations: {},
    values: {},
  });
}

const ORDER = ["REQUESTED", "PENDING", "EXPERIMENTING", "FINALIZING", "CLOSED"];
function reached(current: string, stage: string): boolean {
  const a = ORDER.indexOf(current);
  const b = ORDER.indexOf(stage);
  return a >= 0 && b >= 0 && a >= b;
}

/** Add an as-yet-unrun calculation (a formula with no result) to an experiment. */
export function addUnrunCalculation(
  contextId: string,
  name: string,
  formula: string,
): void {
  const exp = store.experiments.get(contextId);
  if (exp) exp.calculations[name] = { formula };
}

/**
 * Make the ticketing backend refuse this ticket's next status transition with a
 * 422 (the status stays put), simulating a transition guard failing — the way
 * an invalid/disallowed transition is rejected.
 */
export function guardTicketTransition(contextId: string): void {
  store.guarded.add(contextId);
}

/** Current ticket status (used by step assertions). */
export function ticketStatus(contextId: string): string | undefined {
  return store.tickets.get(contextId)?.status;
}

// --- Wire serializers ------------------------------------------------------

function ticketWire(t: LifecycleTicket) {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    organization_id: t.organizationId,
    user_id: t.userId,
    created_at: t.createdAt,
    updated_at: t.createdAt,
    sample_received_at: t.sampleReceivedAt,
    experiment_started_at: t.experimentStartedAt,
    results_submitted_at: t.resultsSubmittedAt,
    closed_at: t.closedAt,
    closed_reason: null,
  };
}

const EMPTY_FORM = { name: "", description: "", questions: [] };
const LAB_FORM = {
  name: "Lab form",
  description: "",
  questions: [
    {
      id: "sample_mass",
      type: "number",
      label: "Sample mass (g)",
      required: false,
      config: { min: 0, max: 1000, step: 0.001 },
    },
  ],
};

function experimentWire(e: LifecycleExperiment) {
  return {
    id: e.id,
    sample_id: e.sampleId,
    template_id: e.templateId,
    report_status: e.reportStatus,
    report_generated_at: e.reportGeneratedAt,
    created_at: e.createdAt,
    clientForm: EMPTY_FORM,
    labForm: LAB_FORM,
    calculations: e.calculations,
    values: e.values,
  };
}

// --- Request handling ------------------------------------------------------

function applyTransitionTimestamp(ticket: LifecycleTicket, target: string): void {
  const now = ISO();
  if (target === "PENDING") ticket.sampleReceivedAt = now;
  if (target === "EXPERIMENTING") ticket.experimentStartedAt = now;
  if (target === "FINALIZING") ticket.resultsSubmittedAt = now;
  if (target === "CLOSED") ticket.closedAt = now;
}

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;

  // ---- ticketing-service: /api/v1/tickets/{id}[/status] -----------------
  if (path[0] === "tickets" && path[1]) {
    const ticket = store.tickets.get(path[1]);
    if (!ticket) return false; // not this feature's ticket

    if (method === "GET" && path.length === 2) {
      return ctx.json(200, ticketWire(ticket));
    }

    if (method === "PATCH" && path[2] === "status") {
      const body = (await ctx.readBody()) as { status?: string };
      const target = body.status ?? "";
      if (store.guarded.has(ticket.id)) {
        return ctx.json(422, {
          error: `Invalid transition: a ${ticket.status} ticket cannot move to ${target} yet.`,
        });
      }
      if (NEXT_STATUS[ticket.status] === target) {
        ticket.status = target;
        applyTransitionTimestamp(ticket, target);
        return ctx.json(200, ticketWire(ticket));
      }
      return ctx.json(422, {
        error: `Invalid transition: a ${ticket.status} ticket cannot move to ${target}.`,
      });
    }
  }

  // ---- experiment-manager: /api/experiments/{id}[/...] ------------------
  if (path[0] === "api" && path[1] === "experiments" && path[2]) {
    const exp = store.experiments.get(path[2]);
    if (!exp) return false; // not this feature's context

    // GET /api/experiments/{id}
    if (method === "GET" && path.length === 3) {
      return ctx.json(200, experimentWire(exp));
    }

    // PUT /api/experiments/{id} — collab buffer flush (submit's persistNow).
    if (method === "PUT" && path.length === 3) {
      const body = (await ctx.readBody()) as { values?: Record<string, unknown> };
      if (body.values) exp.values = body.values;
      return ctx.json(200, experimentWire(exp));
    }

    // POST /api/experiments/{id}/calculate — fill every calculation result.
    if (method === "POST" && path[3] === "calculate") {
      for (const name of Object.keys(exp.calculations)) {
        exp.calculations[name] = { ...exp.calculations[name], result: 42 };
      }
      return ctx.json(200, experimentWire(exp));
    }

    // POST /api/experiments/{id}/report/generate — synchronous success.
    if (method === "POST" && path[3] === "report" && path[4] === "generate") {
      exp.reportStatus = "success";
      exp.reportGeneratedAt = ISO();
      return ctx.json(200, {
        status: "success",
        report_status: "success",
        report_generated_at: exp.reportGeneratedAt,
      });
    }
  }

  return false;
}

registerStub({
  name: "lifecycle",
  reset() {
    store.tickets.clear();
    store.experiments.clear();
    store.guarded.clear();
  },
  handle,
});
