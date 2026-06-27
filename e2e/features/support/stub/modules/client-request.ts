import { randomUUID } from "node:crypto";

import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Backend stub for the "Client — request an experiment" feature. Models the
 * slice of experiment-manager + ticketing that the request catalogue and intake
 * flow exercise:
 *
 *   - experiment-manager (BFF calls it at `/api/...`, no `/api/v1` prefix, so
 *     the stripped `ctx.path` keeps its leading `"api"` segment):
 *       GET  /api/samples                                  → specimen catalogue
 *       GET  /api/samples/{sampleId}/experiments           → templates per sample
 *       GET  /api/samples/{sampleId}/experiments/{tplId}   → template + intake form
 *       POST /api/experiments                              → create context (seed)
 *       PUT  /api/experiments/{expId}                      → persist intake answers
 *       GET  /api/experiments/{expId}                      → workspace detail
 *
 *   - ticketing (BFF calls it at `/api/v1/...`, so `ctx.path` is prefix-stripped):
 *       POST /api/v1/tickets        → create the request (returns the context id)
 *       GET  /api/v1/tickets/{id}   → the workspace ticket (ownership join)
 *
 * Catalogue contents are seeded by step definitions (see the
 * `the catalog offers …` step), mirroring how users/orgs are seeded — the store
 * starts empty each scenario and `reset()` clears it.
 */

/** Label of the single intake question seeded on every catalogue template. */
export const INTAKE_QUESTION_LABEL = "Sample description";

interface FormQuestion {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
}

interface FormDocWire {
  name: string;
  description: string;
  questions: FormQuestion[];
}

interface SeededTemplate {
  id: string;
  lineageId: string;
  sampleId: string;
  name: string;
  description: string;
  clientForm: FormDocWire;
  labForm: FormDocWire;
  calculations: Record<string, never>;
}

interface SeededSample {
  id: string;
  name: string;
  description: string;
}

interface StoredExperiment {
  id: string;
  sampleId: string;
  templateId: string;
  lineageId: string;
  createdAt: string;
  clientForm: FormDocWire;
  labForm: FormDocWire;
  calculations: Record<string, unknown>;
  values: Record<string, unknown>;
}

interface StoredTicket {
  id: string;
  name: string | null;
  status: string;
  experimentTemplateId: string | null;
  organizationId: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

const ISO = new Date("2025-01-01T00:00:00.000Z").toISOString();

const samples: SeededSample[] = [];
const templates: SeededTemplate[] = [];
const experiments = new Map<string, StoredExperiment>();
const tickets = new Map<string, StoredTicket>();

function reset(): void {
  samples.length = 0;
  templates.length = 0;
  experiments.clear();
  tickets.clear();
}

/**
 * Seed one specimen offering one current template whose client intake form has
 * a single required text question. Returns the generated ids so steps can build
 * deep links if needed. Used by the `the catalog offers …` step.
 */
export function seedCatalogTemplate(input: {
  sampleName: string;
  sampleDescription?: string;
  templateTitle: string;
  templateDescription?: string;
}): { sampleId: string; templateId: string; lineageId: string } {
  const sampleId = randomUUID();
  const templateId = randomUUID();
  const lineageId = randomUUID();

  samples.push({
    id: sampleId,
    name: input.sampleName,
    description: input.sampleDescription ?? "",
  });

  const clientForm: FormDocWire = {
    name: "Client intake",
    description: "",
    questions: [
      {
        id: "sample_summary",
        label: INTAKE_QUESTION_LABEL,
        type: "string",
        required: true,
        description: "",
      },
    ],
  };

  templates.push({
    id: templateId,
    lineageId,
    sampleId,
    name: input.templateTitle,
    description: input.templateDescription ?? "",
    clientForm,
    labForm: { name: "Lab worksheet", description: "", questions: [] },
    calculations: {},
  });

  return { sampleId, templateId, lineageId };
}

function templateSummary(tpl: SeededTemplate) {
  return {
    id: tpl.id,
    lineage_id: tpl.lineageId,
    name: tpl.name,
    description: tpl.description,
    version: 1,
    is_current: true,
  };
}

function templateDetail(tpl: SeededTemplate) {
  return {
    ...templateSummary(tpl),
    clientForm: tpl.clientForm,
    labForm: tpl.labForm,
    calculations: tpl.calculations,
  };
}

function experimentDetail(exp: StoredExperiment) {
  return {
    id: exp.id,
    sample_id: exp.sampleId,
    template_id: exp.templateId,
    report_status: null,
    report_r2_key: null,
    report_generated_at: null,
    created_at: exp.createdAt,
    clientForm: exp.clientForm,
    labForm: exp.labForm,
    calculations: exp.calculations,
    values: exp.values,
  };
}

function ticketWire(ticket: StoredTicket) {
  return {
    id: ticket.id,
    name: ticket.name,
    status: ticket.status,
    organization_id: ticket.organizationId,
    user_id: ticket.userId,
    experiment_template: ticket.experimentTemplateId
      ? { experiment_template_id: ticket.experimentTemplateId }
      : undefined,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  };
}

async function handleExperimentManager(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;

  // GET /api/samples
  if (method === "GET" && path[1] === "samples" && path.length === 2) {
    if (samples.length === 0) return false; // not this feature's scenario
    return ctx.json(200, { samples });
  }

  // GET /api/samples/{sampleId}/experiments
  if (
    method === "GET" &&
    path[1] === "samples" &&
    path[2] &&
    path[3] === "experiments" &&
    path.length === 4
  ) {
    if (samples.length === 0) return false; // not this feature's scenario
    const sampleId = decodeURIComponent(path[2]);
    return ctx.json(200, {
      sample_id: sampleId,
      experiments: templates
        .filter((t) => t.sampleId === sampleId)
        .map(templateSummary),
    });
  }

  // GET /api/samples/{sampleId}/experiments/{templateId}
  if (
    method === "GET" &&
    path[1] === "samples" &&
    path[2] &&
    path[3] === "experiments" &&
    path[4] &&
    path.length === 5
  ) {
    const templateId = decodeURIComponent(path[4]);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return false; // not this feature's template
    return ctx.json(200, templateDetail(tpl));
  }

  // POST /api/experiments
  if (method === "POST" && path[1] === "experiments" && path.length === 2) {
    const body = (await ctx.readBody()) as {
      exp_id?: string;
      sample_id?: string;
      lineage_id?: string;
    };
    const id = body.exp_id ?? randomUUID();
    const tpl = templates.find((t) => t.lineageId === body.lineage_id);
    const exp: StoredExperiment = {
      id,
      sampleId: body.sample_id ?? tpl?.sampleId ?? "",
      templateId: tpl?.id ?? "",
      lineageId: body.lineage_id ?? "",
      createdAt: ISO,
      clientForm: tpl?.clientForm ?? { name: "", description: "", questions: [] },
      labForm: tpl?.labForm ?? { name: "", description: "", questions: [] },
      calculations: tpl?.calculations ?? {},
      values: {},
    };
    experiments.set(id, exp);
    return ctx.json(201, experimentDetail(exp));
  }

  // PUT /api/experiments/{expId}
  if (
    method === "PUT" &&
    path[1] === "experiments" &&
    path[2] &&
    path.length === 3
  ) {
    const id = decodeURIComponent(path[2]);
    if (!experiments.has(id)) return false; // only update contexts we created
    const body = (await ctx.readBody()) as {
      clientForm?: FormDocWire;
      labForm?: FormDocWire;
      calculations?: Record<string, unknown>;
      values?: Record<string, unknown>;
    };
    const existing = experiments.get(id);
    const exp: StoredExperiment = {
      id,
      sampleId: existing?.sampleId ?? "",
      templateId: existing?.templateId ?? "",
      lineageId: existing?.lineageId ?? "",
      createdAt: existing?.createdAt ?? ISO,
      clientForm: body.clientForm ?? existing?.clientForm ?? {
        name: "",
        description: "",
        questions: [],
      },
      labForm: body.labForm ?? existing?.labForm ?? {
        name: "",
        description: "",
        questions: [],
      },
      calculations: body.calculations ?? existing?.calculations ?? {},
      values: body.values ?? existing?.values ?? {},
    };
    experiments.set(id, exp);
    return ctx.json(200, experimentDetail(exp));
  }

  // GET /api/experiments/{expId}
  if (
    method === "GET" &&
    path[1] === "experiments" &&
    path[2] &&
    path.length === 3
  ) {
    const id = decodeURIComponent(path[2]);
    const exp = experiments.get(id);
    if (!exp) return false; // not this feature's context
    return ctx.json(200, experimentDetail(exp));
  }

  return false;
}

async function handleTicketing(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;

  // POST /api/v1/tickets
  if (method === "POST" && path[0] === "tickets" && path.length === 1) {
    const body = (await ctx.readBody()) as {
      experiment_template_id?: string;
      name?: string;
      organization_id?: string;
      user_id?: string;
    };
    const id = randomUUID();
    const ticket: StoredTicket = {
      id,
      name: body.name ?? null,
      status: "REQUESTED",
      experimentTemplateId: body.experiment_template_id ?? null,
      organizationId: body.organization_id ?? null,
      userId: body.user_id ?? null,
      createdAt: ISO,
      updatedAt: ISO,
    };
    tickets.set(id, ticket);
    return ctx.json(201, ticketWire(ticket));
  }

  // GET /api/v1/tickets/{id}
  if (
    method === "GET" &&
    path[0] === "tickets" &&
    path[1] &&
    path.length === 2
  ) {
    const ticket = tickets.get(decodeURIComponent(path[1]));
    if (!ticket) return false; // fall through to the benign fallback
    return ctx.json(200, ticketWire(ticket));
  }

  return false;
}

async function handle(ctx: StubContext): Promise<boolean> {
  if (ctx.path[0] === "api") return handleExperimentManager(ctx);
  if (ctx.path[0] === "tickets") return handleTicketing(ctx);
  return false;
}

registerStub({ name: "client-request", reset, handle });
