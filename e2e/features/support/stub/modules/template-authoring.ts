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
  isVisibleOnWeb: boolean;
  displayOrder: number;
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
  pdfComponents: unknown[] | null;
  isVisibleOnWeb: boolean;
  displayOrder: number;
}

const samples: StubSample[] = [];
const templates: StubTemplate[] = [];
let seq = 0;
let failNextWrite = false;
let catalogueWrites = 0;
export function catalogueWriteCount() {
  return catalogueWrites;
}
export function failNextCatalogueWrite() {
  failNextWrite = true;
}
export function findTemplateByName(name: string) {
  return templates.find((row) => row.name === name);
}
function failCatalogueWrite(ctx: StubContext) {
  if (!failNextWrite) return false;
  failNextWrite = false;
  ctx.json(503, { detail: "Catalogue temporarily unavailable" });
  return true;
}
function validateOrder(ids: string[], current: string[]) {
  if (new Set(ids).size !== ids.length) return 422;
  if (ids.some((id) => !current.includes(id))) return 404;
  if (ids.length !== current.length) return 409;
  return null;
}

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
    isVisibleOnWeb: true,
    displayOrder: samples.length + 1,
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
    isVisibleOnWeb: true,
    displayOrder: templates.filter((t) => t.sampleId === sample.id).length + 1,
    clientForm: emptyForm("Client form"),
    labForm: emptyForm("Lab form"),
    calculations: {},
    // Seeded templates already have a report layout — scenarios that care
    // about the "no report layout yet" gating seed it explicitly.
    pdfComponents: [{ type: "text", x: 10, y: 20, content: "Report" }],
  };
  templates.push(template);
  return template;
}

// --- wire serializers ------------------------------------------------------

function sampleWire(s: StubSample) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    is_visible_on_web: s.isVisibleOnWeb,
    display_order: s.displayOrder,
  };
}

function templateSummaryWire(t: StubTemplate) {
  return {
    id: t.id,
    lineage_id: t.lineageId,
    name: t.name,
    description: t.description,
    version: t.version,
    is_current: t.isCurrent,
    has_pdf_template: Boolean(t.pdfComponents && t.pdfComponents.length > 0),
    is_visible_on_web: t.isVisibleOnWeb,
    display_order: t.displayOrder,
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
  if (
    (method === "PATCH" && rest.at(-1) === "web-visibility") ||
    (method === "PUT" && rest.at(-1) === "web-order")
  )
    catalogueWrites += 1;

  // /api/samples
  if (rest.length === 0) {
    if (method === "GET") {
      return ctx.json(200, {
        samples: [...samples]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(sampleWire),
      });
    }
    if (method === "POST") {
      const body = (await ctx.readBody()) as {
        name?: string;
        description?: string | null;
      };
      const name = body.name?.trim();
      if (!name) return ctx.json(422, { detail: "name is required" });
      const sample = seedSample(name, body.description ?? undefined);
      sample.isVisibleOnWeb = false;
      return ctx.json(201, sampleWire(sample));
    }
    return false;
  }

  if (method === "PUT" && rest.length === 1 && rest[0] === "web-order") {
    if (failCatalogueWrite(ctx)) return true;
    const { sample_ids: ids } = (await ctx.readBody()) as {
      sample_ids: string[];
    };
    const error = validateOrder(
      ids,
      samples.map((row) => row.id),
    );
    if (error) return ctx.json(error, { detail: "Invalid catalogue order" });
    ids.forEach((id, index) => {
      samples.find((row) => row.id === id)!.displayOrder = index + 1;
    });
    return ctx.json(200, {
      samples: [...samples]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(sampleWire),
    });
  }
  const sampleId = decodeURIComponent(rest[0]);
  const sample = samples.find((s) => s.id === sampleId);

  if (rest.length === 2 && rest[1] === "web-visibility" && method === "PATCH") {
    if (failCatalogueWrite(ctx)) return true;
    if (!sample) return ctx.json(404, { detail: "sample not found" });
    const body = (await ctx.readBody()) as { is_visible_on_web: boolean };
    sample.isVisibleOnWeb = body.is_visible_on_web;
    return ctx.json(200, sampleWire(sample));
  }
  if (
    rest.length === 3 &&
    rest[1] === "experiments" &&
    rest[2] === "web-order" &&
    method === "PUT"
  ) {
    if (failCatalogueWrite(ctx)) return true;
    if (!sample) return ctx.json(404, { detail: "sample not found" });
    const { lineage_ids: ids } = (await ctx.readBody()) as {
      lineage_ids: string[];
    };
    const rows = templates.filter(
      (t) => t.sampleId === sampleId && t.isCurrent,
    );
    const error = validateOrder(
      ids,
      rows.map((row) => row.lineageId),
    );
    if (error) return ctx.json(error, { detail: "Invalid catalogue order" });
    ids.forEach((id, index) => {
      rows.find((row) => row.lineageId === id)!.displayOrder = index + 1;
    });
    return ctx.json(200, {
      sample_id: sampleId,
      experiments: rows
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(templateSummaryWire),
    });
  }
  if (
    rest.length === 4 &&
    rest[1] === "experiments" &&
    rest[3] === "web-visibility" &&
    method === "PATCH"
  ) {
    if (failCatalogueWrite(ctx)) return true;
    const row = templates.find(
      (t) => t.sampleId === sampleId && t.lineageId === rest[2] && t.isCurrent,
    );
    if (!sample || !row) return ctx.json(404, { detail: "template not found" });
    const body = (await ctx.readBody()) as { is_visible_on_web: boolean };
    row.isVisibleOnWeb = body.is_visible_on_web;
    return ctx.json(200, templateSummaryWire(row));
  }

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
      const rows = templates
        .filter((t) => t.sampleId === sampleId && t.isCurrent)
        .sort((a, b) => a.displayOrder - b.displayOrder);
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
        isVisibleOnWeb: false,
        displayOrder:
          templates.filter((t) => t.sampleId === sampleId).length + 1,
        clientForm: body.clientForm ?? emptyForm("Client form"),
        labForm: body.labForm ?? emptyForm("Lab form"),
        calculations: body.calculations ?? {},
        // Freshly created templates have no report layout yet — matches the
        // real backend, which never creates a PdfTemplate on template create.
        pdfComponents: null,
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
      const t = templates.find((x) => x.sampleId === sampleId && x.id === ref);
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

  // /api/samples/{id}/experiments/{templateId}/pdf (GET) or
  // /api/samples/{id}/experiments/{lineageId}/pdf (PUT)
  if (rest.length === 4 && rest[1] === "experiments" && rest[3] === "pdf") {
    const ref = decodeURIComponent(rest[2]);
    if (method === "GET") {
      const t = templates.find((x) => x.sampleId === sampleId && x.id === ref);
      if (!t || !t.pdfComponents) {
        return ctx.json(404, { detail: "no pdf template" });
      }
      return ctx.json(200, {
        template_id: t.id,
        is_current: t.isCurrent,
        components: t.pdfComponents,
        updated_at: new Date().toISOString(),
      });
    }
    if (method === "PUT") {
      const t = templates.find(
        (x) => x.sampleId === sampleId && x.lineageId === ref,
      );
      if (!t) return ctx.json(404, { detail: "template not found" });
      const body = (await ctx.readBody()) as { components?: unknown[] };
      t.pdfComponents = body.components ?? [];
      return ctx.json(200, {
        template_id: t.id,
        is_current: t.isCurrent,
        components: t.pdfComponents,
        updated_at: new Date().toISOString(),
      });
    }
    return false;
  }

  return false;
}

registerStub({
  name: "experiment-manager:template-authoring",
  // Owns the baseline specimen collection; seeded feature modules take priority.
  priority: -100,
  reset() {
    samples.length = 0;
    templates.length = 0;
    seq = 0;
    failNextWrite = false;
    catalogueWrites = 0;
    // Seed one baseline sample so scenarios have a known specimen to open.
    seedSample("Coal", "Raw coal samples for proximate analysis");
  },
  handle,
});
