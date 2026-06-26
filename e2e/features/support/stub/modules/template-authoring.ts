import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * experiment-manager stub for the staff "sample & template authoring"
 * (onboarding) feature. Models the samples + nested experiment-template
 * endpoints the BFF calls server-side:
 *
 *   GET    /api/samples                                  list samples
 *   POST   /api/samples                                  create a sample
 *   GET    /api/samples/{id}                             get a sample
 *   GET    /api/samples/{id}/experiments                 list templates
 *   POST   /api/samples/{id}/experiments                 create a template
 *   GET    /api/samples/{id}/experiments/{templateId}    get a template
 *   PUT    /api/samples/{id}/experiments/{lineageId}     update a template
 *   DELETE /api/samples/{id}/experiments/{templateId}    delete a template
 *
 * The store is module-local; `reset()` clears it and seeds a single sample so
 * every scenario starts from a known baseline (matching the harness rule that a
 * feature owns its own entities). Step definitions seed extra data via the
 * exported helpers below — same process, plain mutation, no HTTP round-trip.
 *
 * Note: experiment-manager URLs are NOT under the shared `/api/v1` prefix, so
 * `ctx.path` here is `["api", "samples", …]` (the server only strips `/api/v1`).
 */

interface FormDocLike {
  name: string;
  description?: string | null;
  questions: unknown[];
}

export interface StubSample {
  id: string;
  name: string;
  description: string | null;
}

export interface StubTemplate {
  id: string;
  lineageId: string;
  sampleId: string;
  name: string;
  description: string | null;
  version: number;
  isCurrent: boolean;
  clientForm: FormDocLike;
  labForm: FormDocLike;
  calculations: Record<string, unknown>;
}

const samples: StubSample[] = [];
const templates: StubTemplate[] = [];
let seq = 0;

/** A deterministic, uuid-shaped id (experiment-manager ids are uuids). */
function uuid(seed: string): string {
  const hex = Buffer.from(seed).toString("hex").padEnd(32, "0").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function nextId(prefix: string): string {
  seq += 1;
  return uuid(`${prefix}-${seq}`);
}

function emptyForm(name: string): FormDocLike {
  return { name, description: "", questions: [] };
}

// --- seed helpers (used by step definitions) ------------------------------

export function findSampleByName(name: string): StubSample | undefined {
  return samples.find((s) => s.name === name);
}

export function seedSample(name: string, description?: string): StubSample {
  const existing = findSampleByName(name);
  if (existing) return existing;
  const sample: StubSample = {
    id: nextId("sample"),
    name,
    description: description ?? null,
  };
  samples.push(sample);
  return sample;
}

export function seedTemplate(
  sampleName: string,
  name: string,
  description?: string,
): StubTemplate {
  const sample = seedSample(sampleName);
  const id = nextId("tpl");
  const template: StubTemplate = {
    id,
    lineageId: nextId("lineage"),
    sampleId: sample.id,
    name,
    description: description ?? null,
    version: 1,
    isCurrent: true,
    clientForm: emptyForm("Client form"),
    labForm: emptyForm("Lab form"),
    calculations: {},
  };
  templates.push(template);
  return template;
}

// --- wire serializers ------------------------------------------------------

function sampleWire(s: StubSample) {
  return { id: s.id, name: s.name, description: s.description };
}

function templateSummaryWire(t: StubTemplate) {
  return {
    id: t.id,
    lineage_id: t.lineageId,
    name: t.name,
    description: t.description,
    version: t.version,
    is_current: t.isCurrent,
  };
}

function templateDetailWire(t: StubTemplate) {
  return {
    ...templateSummaryWire(t),
    clientForm: t.clientForm,
    labForm: t.labForm,
    calculations: t.calculations,
  };
}

// --- request handling ------------------------------------------------------

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;
  if (path[0] !== "api" || path[1] !== "samples") return false;
  const rest = path.slice(2);

  // /api/samples
  if (rest.length === 0) {
    if (method === "GET") {
      return ctx.json(200, { samples: samples.map(sampleWire) });
    }
    if (method === "POST") {
      const body = (await ctx.readBody()) as {
        name?: string;
        description?: string | null;
      };
      const name = body.name?.trim();
      if (!name) return ctx.json(422, { detail: "name is required" });
      const sample = seedSample(name, body.description ?? undefined);
      return ctx.json(201, sampleWire(sample));
    }
    return false;
  }

  const sampleId = decodeURIComponent(rest[0]);
  const sample = samples.find((s) => s.id === sampleId);

  // /api/samples/{id}
  if (rest.length === 1) {
    if (method === "GET") {
      if (!sample) return ctx.json(404, { detail: "sample not found" });
      return ctx.json(200, sampleWire(sample));
    }
    return false;
  }

  // /api/samples/{id}/experiments
  if (rest.length === 2 && rest[1] === "experiments") {
    if (method === "GET") {
      const rows = templates.filter((t) => t.sampleId === sampleId);
      return ctx.json(200, {
        sample_id: sampleId,
        experiments: rows.map(templateSummaryWire),
      });
    }
    if (method === "POST") {
      if (!sample) return ctx.json(404, { detail: "sample not found" });
      const body = (await ctx.readBody()) as {
        name?: string;
        description?: string | null;
        clientForm?: FormDocLike;
        labForm?: FormDocLike;
        calculations?: Record<string, unknown>;
      };
      const name = body.name?.trim();
      if (!name) return ctx.json(422, { detail: "name is required" });
      const template: StubTemplate = {
        id: nextId("tpl"),
        lineageId: nextId("lineage"),
        sampleId,
        name,
        description: body.description ?? null,
        version: 1,
        isCurrent: true,
        clientForm: body.clientForm ?? emptyForm("Client form"),
        labForm: body.labForm ?? emptyForm("Lab form"),
        calculations: body.calculations ?? {},
      };
      templates.push(template);
      return ctx.json(201, templateDetailWire(template));
    }
    return false;
  }

  // /api/samples/{id}/experiments/{templateId|lineageId}
  if (rest.length === 3 && rest[1] === "experiments") {
    const ref = decodeURIComponent(rest[2]);
    if (method === "GET") {
      const t = templates.find(
        (x) => x.sampleId === sampleId && x.id === ref,
      );
      if (!t) return ctx.json(404, { detail: "template not found" });
      return ctx.json(200, templateDetailWire(t));
    }
    if (method === "PUT") {
      // The client addresses updates by lineage id (not the version id).
      const t = templates.find(
        (x) => x.sampleId === sampleId && x.lineageId === ref,
      );
      if (!t) return ctx.json(404, { detail: "template not found" });
      const body = (await ctx.readBody()) as {
        name?: string;
        description?: string | null;
        clientForm?: FormDocLike;
        labForm?: FormDocLike;
        calculations?: Record<string, unknown>;
      };
      if (typeof body.name === "string" && body.name.trim()) {
        t.name = body.name.trim();
      }
      if (body.description !== undefined) t.description = body.description;
      if (body.clientForm) t.clientForm = body.clientForm;
      if (body.labForm) t.labForm = body.labForm;
      if (body.calculations) t.calculations = body.calculations;
      return ctx.json(200, templateDetailWire(t));
    }
    if (method === "DELETE") {
      const idx = templates.findIndex(
        (x) => x.sampleId === sampleId && x.id === ref,
      );
      if (idx < 0) return ctx.json(404, { detail: "template not found" });
      templates.splice(idx, 1);
      return ctx.json(204, {});
    }
    return false;
  }

  return false;
}

registerStub({
  name: "experiment-manager:template-authoring",
  reset() {
    samples.length = 0;
    templates.length = 0;
    seq = 0;
    // Seed one baseline sample so scenarios have a known specimen to open.
    seedSample("Coal", "Raw coal samples for proximate analysis");
  },
  handle,
});
