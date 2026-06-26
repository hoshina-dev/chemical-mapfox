import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Staff finalization stage (calculations + PDF report). Models the slice of
 * ticketing-service + experiment-manager the FINALIZING workspace drives:
 *
 *  - ticketing  GET   /api/v1/tickets/{id}            → the FINALIZING ticket
 *  - ticketing  PATCH /api/v1/tickets/{id}/status     → the final close (→ CLOSED)
 *  - em         GET   /api/experiments/{id}           → context (calculations + report_status)
 *  - em         POST  /api/experiments/{id}/calculate → fills calculation results
 *  - em         POST  /api/experiments/{id}/report/generate  → queues report (async)
 *  - em         GET   /api/experiments/{id}/report/download  → presigned URL once ready
 *
 * Report generation is asynchronous: `generate` queues it (status "pending") and
 * each subsequent `GET /experiments/{id}` advances the status one step
 * (pending → processing → success), so the workspace's poll loop observes a
 * realistic progression before the download URL becomes available.
 *
 * Per-scenario state is anchored on `globalThis` so the single store is shared
 * no matter how the module is resolved (the stub server auto-loads it by
 * absolute path; step definitions import it by relative specifier) and reset()
 * clears it before each scenario.
 */

type Scalar = string | number | boolean | null;

interface SeededCalculation {
  /** Human-readable formula shown in the UI. */
  formula: string;
  /** Evaluated against the experiment values when calculations run. */
  compute: (values: Record<string, number>) => number;
  /** Populated once calculations have been run. */
  result?: Scalar;
}

interface FinalizationExperiment {
  contextId: string;
  ticketName: string;
  userId: string;
  organizationId: string;
  templateId: string;
  sampleId: string;
  ticketStatus: string;
  createdAt: string;
  sampleReceivedAt: string;
  experimentStartedAt: string;
  resultsSubmittedAt: string;
  closedAt: string | null;
  values: Record<string, number>;
  calculations: Record<string, SeededCalculation>;
  reportStatus: string | null;
  reportGeneratedAt: string | null;
}

interface FinalizationStore {
  experiments: Map<string, FinalizationExperiment>;
}

const store: FinalizationStore = ((
  globalThis as { __finalizationStore?: FinalizationStore }
).__finalizationStore ??= { experiments: new Map() });

const ISO = "2025-03-01T08:00:00.000Z";

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Seed a ticket sitting in FINALIZING with an experiment context whose template
 * defines one calculation (no result yet) and no report. Returns the contextId.
 */
export function seedFinalizingExperiment(contextId: string): void {
  store.experiments.set(contextId, {
    contextId,
    ticketName: "Coal proximate analysis",
    userId: "requester-001",
    organizationId: "11111111-2222-4333-8444-555555555555",
    templateId: "template-001",
    sampleId: "sample-001",
    ticketStatus: "FINALIZING",
    createdAt: ISO,
    sampleReceivedAt: "2025-03-01T09:00:00.000Z",
    experimentStartedAt: "2025-03-01T10:00:00.000Z",
    resultsSubmittedAt: "2025-03-01T11:00:00.000Z",
    closedAt: null,
    values: { mass_pure: 9, mass_total: 10 },
    calculations: {
      purity: {
        formula: "mass_pure / mass_total * 100",
        compute: (v) => round((v.mass_pure / v.mass_total) * 100),
      },
    },
    reportStatus: null,
    reportGeneratedAt: null,
  });
}

function reset(): void {
  store.experiments.clear();
}

/** Serialize calculations to the experiment-manager wire shape. */
function calculationsWire(
  exp: FinalizationExperiment,
): Record<string, { formula: string; result?: Scalar }> {
  const out: Record<string, { formula: string; result?: Scalar }> = {};
  for (const [name, calc] of Object.entries(exp.calculations)) {
    out[name] =
      calc.result !== undefined && calc.result !== null
        ? { formula: calc.formula, result: calc.result }
        : { formula: calc.formula };
  }
  return out;
}

/** The experiment-manager ExperimentDetail wire body for a context. */
function experimentWire(exp: FinalizationExperiment) {
  return {
    id: exp.contextId,
    sample_id: exp.sampleId,
    template_id: exp.templateId,
    report_status: exp.reportStatus,
    report_generated_at: exp.reportGeneratedAt,
    created_at: exp.createdAt,
    clientForm: { name: "Client intake", description: "", questions: [] },
    labForm: {
      name: "Lab form",
      description: "",
      questions: [
        { id: "mass_pure", label: "Pure mass (g)", type: "number" },
        { id: "mass_total", label: "Total mass (g)", type: "number" },
      ],
    },
    calculations: calculationsWire(exp),
    values: exp.values,
  };
}

/** The ticketing-service TicketResponse wire body for a context. */
function ticketWire(exp: FinalizationExperiment) {
  return {
    id: exp.contextId,
    name: exp.ticketName,
    status: exp.ticketStatus,
    organization_id: exp.organizationId,
    user_id: exp.userId,
    experiment_template: { experiment_template_id: exp.templateId },
    created_at: exp.createdAt,
    updated_at: exp.createdAt,
    sample_received_at: exp.sampleReceivedAt,
    experiment_started_at: exp.experimentStartedAt,
    results_submitted_at: exp.resultsSubmittedAt,
    closed_at: exp.closedAt,
  };
}

/**
 * Advance an in-flight report one step on each read, so the workspace's poll
 * loop watches pending → processing → success (the terminal state is stable).
 */
function advanceReport(exp: FinalizationExperiment): void {
  if (exp.reportStatus === "pending") {
    exp.reportStatus = "processing";
  } else if (exp.reportStatus === "processing") {
    exp.reportStatus = "success";
    exp.reportGeneratedAt = "2025-03-01T12:00:00.000Z";
  }
}

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;

  // ---- ticketing-service: /api/v1/tickets/{id}[/status] -----------------
  if (path[0] === "tickets" && path[1]) {
    const exp = store.experiments.get(decodeURIComponent(path[1]));
    if (!exp) return false;

    if (method === "GET" && path.length === 2) {
      return ctx.json(200, ticketWire(exp));
    }

    if (method === "PATCH" && path[2] === "status") {
      const body = (await ctx.readBody()) as { status?: string };
      if (body.status) {
        exp.ticketStatus = body.status;
        if (body.status === "CLOSED") {
          exp.closedAt = "2025-03-01T12:05:00.000Z";
        }
      }
      return ctx.json(200, ticketWire(exp));
    }
  }

  // ---- experiment-manager: /api/experiments/{id}/... --------------------
  if (path[0] === "api" && path[1] === "experiments" && path[2]) {
    const exp = store.experiments.get(decodeURIComponent(path[2]));
    if (!exp) return false;
    const sub = path[3];

    if (method === "GET" && path.length === 3) {
      // A status read while a report job is in flight advances it one step.
      advanceReport(exp);
      return ctx.json(200, experimentWire(exp));
    }

    if (method === "POST" && sub === "calculate") {
      for (const calc of Object.values(exp.calculations)) {
        calc.result = calc.compute(exp.values);
      }
      return ctx.json(200, experimentWire(exp));
    }

    if (method === "POST" && sub === "report" && path[4] === "generate") {
      exp.reportStatus = "pending";
      exp.reportGeneratedAt = null;
      return ctx.json(200, { status: exp.reportStatus });
    }

    if (method === "GET" && sub === "report" && path[4] === "download") {
      if (exp.reportStatus === "success" || exp.reportStatus === "succeeded") {
        return ctx.json(200, {
          // A minimal but valid PDF, inlined as a data: URL so the report route
          // can fetch real bytes without a second network hop.
          url:
            "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8" +
            "PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8" +
            "PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAw" +
            "IG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2" +
            "MCA2MF0+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0Y=",
          expires_in: 900,
        });
      }
      return ctx.json(404, { error: "report not ready" });
    }
  }

  return false;
}

registerStub({ name: "finalization", reset, handle });
