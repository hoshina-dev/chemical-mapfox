import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Backend stub for the **staff collaborative lab-form editing** feature.
 *
 * It models just enough of two backends for the workspace page + the realtime
 * collab layer to run end-to-end against a *real* Redis:
 *
 *  - **ticketing-service** `GET /api/v1/tickets/{id}` — the ticket whose status
 *    decides whether the lab form is an editable collaborative editor
 *    (`EXPERIMENTING`) or a read-only view with a "Start experiment" gate
 *    (`PENDING`, …).
 *  - **experiment-manager** `GET /api/experiments/{id}` (the form schema +
 *    stored values, used both by the page and by the collab room's Redis
 *    hydration) and `PUT /api/experiments/{id}` (the autosave flush). Each PUT
 *    is recorded so a step can assert the experiment was actually persisted.
 *
 * The collab transport itself (SSE stream + POST events + Redis pub/sub) is the
 * app's real code — it is *not* stubbed here.
 *
 * Per-context state is seeded by steps via {@link seedCollabExperiment} and
 * cleared in `reset()` before every scenario. Because the Cucumber process and
 * this stub share one Node process, steps read the recorded autosaves directly.
 */

/** The single lab-form question this feature exercises. */
export const LAB_FIELD_ID = "observations";
export const LAB_FIELD_LABEL = "Observations";

const ISO = new Date("2025-01-01T00:00:00.000Z").toISOString();

interface CollabExperiment {
  contextId: string;
  status: string;
  name: string;
  userId: string;
  organizationId: string;
  /** Live stored values (mutated by autosave PUTs). */
  values: Record<string, unknown>;
  /** How many times experiment-manager `updateExperiment` (PUT) was called. */
  updateCount: number;
}

const experiments = new Map<string, CollabExperiment>();

export interface SeedCollabInput {
  contextId: string;
  status: string;
  name?: string;
  userId?: string;
  organizationId?: string;
  values?: Record<string, unknown>;
}

/** Seed (or replace) a ticket + experiment context for one collab scenario. */
export function seedCollabExperiment(input: SeedCollabInput): CollabExperiment {
  const record: CollabExperiment = {
    contextId: input.contextId,
    status: input.status,
    name: input.name ?? "Viscosity run",
    userId: input.userId ?? "user-requester",
    organizationId:
      input.organizationId ?? "00000000-0000-4000-8000-000000000001",
    values: { ...(input.values ?? {}) },
    updateCount: 0,
  };
  experiments.set(input.contextId, record);
  return record;
}

/** Number of autosave PUTs experiment-manager received for a context. */
export function collabUpdateCount(contextId: string): number {
  return experiments.get(contextId)?.updateCount ?? 0;
}

/** The last persisted values for a context (post-autosave). */
export function collabStoredValues(
  contextId: string,
): Record<string, unknown> {
  return experiments.get(contextId)?.values ?? {};
}

function ticketWire(record: CollabExperiment) {
  return {
    id: record.contextId,
    name: record.name,
    status: record.status,
    organization_id: record.organizationId,
    user_id: record.userId,
    created_at: ISO,
    updated_at: ISO,
    sample_received_at: ISO,
    // Only stamp "experiment started" once it actually has.
    experiment_started_at: record.status === "EXPERIMENTING" ? ISO : null,
  };
}

/**
 * The experiment-manager detail shape `experimentDetailToState` reads: snake
 * case context keys + camelCase `clientForm`/`labForm` snapshots + `values`.
 * A deliberately minimal lab form: one editable string field, no client form,
 * no calculations.
 */
function experimentDetailWire(record: CollabExperiment) {
  return {
    id: record.contextId,
    sample_id: "sample-collab",
    template_id: "template-collab",
    report_status: null,
    report_generated_at: null,
    created_at: ISO,
    clientForm: { name: "Client intake", description: "", questions: [] },
    labForm: {
      name: "Lab form",
      description: "Live multi-staff readings",
      questions: [
        {
          id: LAB_FIELD_ID,
          type: "string",
          label: LAB_FIELD_LABEL,
          description: "",
          required: false,
        },
      ],
    },
    calculations: {},
    values: record.values,
  };
}

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;

  // ---- ticketing-service: GET /api/v1/tickets/{id} (prefix stripped) --------
  if (method === "GET" && path[0] === "tickets" && path[1] && path.length === 2) {
    const record = experiments.get(decodeURIComponent(path[1]));
    if (!record) return false; // let other tickets fall through to the benign stub
    return ctx.json(200, ticketWire(record));
  }

  // ---- experiment-manager (no /api/v1 prefix → path keeps "api") ------------
  if (path[0] === "api" && path[1] === "experiments" && path[2]) {
    const id = decodeURIComponent(path[2]);
    const record = experiments.get(id);
    if (!record) return false;

    if (method === "GET" && path.length === 3) {
      return ctx.json(200, experimentDetailWire(record));
    }

    if (method === "PUT" && path.length === 3) {
      const body = (await ctx.readBody()) as {
        values?: Record<string, unknown> | null;
      };
      record.values = { ...(body.values ?? {}) };
      record.updateCount += 1;
      return ctx.json(200, experimentDetailWire(record));
    }
  }

  // ---- experiment-manager: GET /api/samples (template index sweep) ----------
  // The workspace loads a template index best-effort; answer cleanly so it
  // doesn't fall through to the array fallback (which would throw on `.samples`).
  if (method === "GET" && path[0] === "api" && path[1] === "samples" && path.length === 2) {
    if (experiments.size === 0) return false; // not this feature's scenario
    return ctx.json(200, { samples: [] });
  }

  return false;
}

registerStub({ name: "collab-editing", reset: () => experiments.clear(), handle });
