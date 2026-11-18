import { randomUUID } from "node:crypto";

import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * In-memory sample_tracker (`SAMPLE_TRACKER_URL`, `/api/v1` stripped by the
 * server). Mirrors the real service's routes, derived statuses, guards and
 * error messages (hoshina-dev/sample_tracker `internal/router/router.go`,
 * `internal/repository/ticket_lifecycle_repository.go`), so the BFF is driven
 * exactly as in production. Step definitions seed it through the helpers below.
 */

// --- model -------------------------------------------------------------------

export type TicketStatus =
  | "REQUESTED"
  | "RECEIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

type Json = Record<string, unknown>;

export interface StSampleType {
  id: string;
  name: string;
  description: string | null;
  reportForm: { fields: unknown[] } | null;
  reportPdf: Buffer | null;
  isVisibleOnWeb: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StTemplate {
  id: string;
  sampleTypeId: string;
  name: string;
  description: string | null;
  template: Json;
  isVisibleOnWeb: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StExperiment {
  id: string;
  experimentTemplateId: string;
  templateName: string;
  startedAt: string | null;
  finishedAt: string | null;
  contextVersion: number;
  /** `{clientForm, labForm, calculations, values}`; numbers kept as their JSON text. */
  context: Json;
  createdAt: string;
  updatedAt: string;
}

export interface StEvent {
  id: number;
  type: string;
  experimentId: string | null;
  actorUserId: string;
  occurredAt: string;
  data: Json;
}

export interface StTicket {
  id: string;
  name: string;
  sampleTypeId: string;
  requesterUserId: string;
  organizationId: string;
  description: string | null;
  requestedAt: string;
  receivedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  updatedAt: string;
  experiments: StExperiment[];
  events: StEvent[];
}

interface Store {
  sampleTypes: StSampleType[];
  templates: StTemplate[];
  tickets: StTicket[];
  preferences: Map<string, { eventType: string; emailEnabled: boolean }[]>;
  eventSeq: number;
  /** Status + message the next matching write fails with (test fault injection). */
  failures: {
    match: (ctx: StubContext) => boolean;
    status: number;
    message: string;
  }[];
  writes: { method: string; path: string; body: unknown }[];
}

const store: Store = {
  sampleTypes: [],
  templates: [],
  tickets: [],
  preferences: new Map(),
  eventSeq: 0,
  failures: [],
  writes: [],
};

export const sampleTracker = store;

const EMAIL_EVENTS = [
  "ticket.requested",
  "ticket.received",
  "experiment.finished",
  "ticket.completed",
  "ticket.closed",
];

const now = () => new Date().toISOString();

// Numbers keep their JSON text, as Postgres jsonb + Go's RawMessage do: the BFF
// relies on 5.0 coming back as 5.0.
const J = JSON as unknown as {
  rawJSON(text: string): unknown;
  isRawJSON(value: unknown): boolean;
};

function parseExact(text: string): unknown {
  const reviver = (_k: string, v: unknown, c?: { source?: string }) =>
    typeof v === "number" ? J.rawJSON(c?.source ?? String(v)) : v;
  return JSON.parse(text, reviver as (k: string, v: unknown) => unknown);
}

const clone = <T>(v: T): T => parseExact(JSON.stringify(v)) as T;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v) && !J.isRawJSON(v);
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** RFC 7386 JSON Merge Patch. */
function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch;
  const out: Json = isObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

// --- derived status (the ticket_overview / experiment_overview views) ---------

export function experimentStatus(e: StExperiment) {
  if (e.finishedAt) return "FINISHED";
  if (e.startedAt) return "IN_PROGRESS";
  return "PENDING";
}

export function ticketStatus(t: StTicket): TicketStatus {
  if (t.closedAt && t.closedReason) return "CANCELLED";
  if (t.closedAt) return "CLOSED";
  if (!t.receivedAt) return "REQUESTED";
  const finished = t.experiments.filter((e) => e.finishedAt).length;
  if (t.experiments.length > 0 && finished === t.experiments.length)
    return "COMPLETED";
  if (t.experiments.some((e) => e.startedAt)) return "IN_PROGRESS";
  return "RECEIVED";
}

const reportPublishedAt = (t: StTicket) =>
  t.events.filter((e) => e.type === "ticket.report_published").at(-1)
    ?.occurredAt ?? null;

// --- wire shapes ---------------------------------------------------------------

const sampleTypeWire = ({ reportPdf: _pdf, ...st }: StSampleType) => st;

function summaryWire(t: StTicket) {
  return {
    id: t.id,
    name: t.name,
    sampleTypeId: t.sampleTypeId,
    requesterUserId: t.requesterUserId,
    organizationId: t.organizationId,
    description: t.description,
    status: ticketStatus(t),
    total: t.experiments.length,
    started: t.experiments.filter((e) => e.startedAt).length,
    finished: t.experiments.filter((e) => e.finishedAt).length,
    requestedAt: t.requestedAt,
    receivedAt: t.receivedAt,
    closedAt: t.closedAt,
    closedReason: t.closedReason,
    reportPublishedAt: reportPublishedAt(t),
    updatedAt: t.updatedAt,
  };
}

function ticketWire(t: StTicket) {
  return {
    ...summaryWire(t),
    experiments: t.experiments.map((e) => ({
      ...e,
      status: experimentStatus(e),
    })),
  };
}

// --- a minimal valid PDF -------------------------------------------------------

/** A one-page A4 PDF printing `lines` (Helvetica), with a correct xref table. */
export function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = [
    "BT /F1 12 Tf 72 770 Td 16 TL",
    ...lines.map((l) => `(${esc(l)}) '`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// --- seed helpers (step definitions) ---------------------------------------------

export interface FormQuestion {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  description?: string;
  config?: Json;
}

export interface TemplateBody {
  clientForm?: {
    name?: string;
    description?: string;
    questions: FormQuestion[];
  };
  labForm?: { name?: string; description?: string; questions: FormQuestion[]; dishRun?: Json };
  calculations?: Record<string, { formula: string; result?: unknown }>;
}

function templateJson(body: TemplateBody = {}): Json {
  return clone({
    clientForm: {
      name: "Client form",
      description: "",
      questions: [],
      ...body.clientForm,
    },
    labForm: {
      name: "Lab form",
      description: "",
      questions: [],
      ...body.labForm,
    },
    calculations: Object.fromEntries(
      Object.entries(body.calculations ?? {}).map(([k, c]) => [
        k,
        { formula: c.formula, result: c.result ?? "" },
      ]),
    ),
  });
}

export const findSampleType = (name: string) =>
  store.sampleTypes.find((s) => s.name === name);
export const findTemplate = (name: string) =>
  store.templates.find((t) => t.name === name);
export const findTicket = (id: string) =>
  store.tickets.find((t) => t.id === id);

/**
 * A sample type, visible and with a report form unless told otherwise (seeded
 * catalogues are ready to request; scenarios about the gating opt out).
 */
export function seedSampleType(
  name: string,
  opts: { description?: string; visible?: boolean; reportForm?: boolean } = {},
): StSampleType {
  const existing = findSampleType(name);
  if (existing) return existing;
  const at = now();
  const st: StSampleType = {
    id: randomUUID(),
    name,
    description: opts.description ?? null,
    reportForm: opts.reportForm === false ? null : { fields: [] },
    reportPdf: opts.reportForm === false ? null : makePdf([`${name} report`]),
    isVisibleOnWeb: opts.visible ?? true,
    displayOrder: store.sampleTypes.length + 1,
    createdAt: at,
    updatedAt: at,
  };
  store.sampleTypes.push(st);
  return st;
}

/** A template (method) of a sample type, visible unless told otherwise. */
export function seedTemplate(
  sampleTypeName: string,
  name: string,
  opts: { description?: string; visible?: boolean; body?: TemplateBody } = {},
): StTemplate {
  const st = seedSampleType(sampleTypeName);
  const at = now();
  const tpl: StTemplate = {
    id: randomUUID(),
    sampleTypeId: st.id,
    name,
    description: opts.description ?? null,
    template: templateJson(opts.body),
    isVisibleOnWeb: opts.visible ?? true,
    displayOrder:
      store.templates.filter((t) => t.sampleTypeId === st.id).length + 1,
    createdAt: at,
    updatedAt: at,
  };
  store.templates.push(tpl);
  return tpl;
}

/** The stage a seeded ticket is put in, applied to all of its experiments. */
export type SeedStage = TicketStatus;

export interface SeedTicketInput {
  id?: string;
  name: string;
  requesterUserId: string;
  organizationId: string;
  stage?: SeedStage;
  /** Methods of the ticket; default one empty method named after the ticket. */
  methods?: { name: string; body?: TemplateBody; values?: Json }[];
  sampleTypeName?: string;
  description?: string | null;
  requestedAt?: string;
  updatedAt?: string;
  closedReason?: string;
  reportPublished?: boolean;
}

function event(
  t: StTicket,
  type: string,
  actor: string,
  experimentId: string | null,
  data: Json = {},
) {
  store.eventSeq += 1;
  t.events.push({
    id: store.eventSeq,
    type,
    experimentId,
    actorUserId: actor,
    occurredAt: now(),
    data,
  });
}

/** A ticket built through the real state machine's timestamps. */
export function seedTicket(input: SeedTicketInput): StTicket {
  const st = seedSampleType(input.sampleTypeName ?? "Coal");
  const methods = input.methods ?? [{ name: input.name }];
  const requestedAt = input.requestedAt ?? "2025-01-01T09:00:00.000Z";
  const stage = input.stage ?? "REQUESTED";
  const reached = (s: TicketStatus) => {
    const order: TicketStatus[] = [
      "REQUESTED",
      "RECEIVED",
      "IN_PROGRESS",
      "COMPLETED",
      "CLOSED",
    ];
    return stage === "CANCELLED"
      ? s === "REQUESTED"
      : order.indexOf(stage) >= order.indexOf(s);
  };
  const stamp = (offsetMin: number) =>
    new Date(Date.parse(requestedAt) + offsetMin * 60_000).toISOString();
  const ticket: StTicket = {
    id: input.id ?? randomUUID(),
    name: input.name,
    sampleTypeId: st.id,
    requesterUserId: input.requesterUserId,
    organizationId: input.organizationId,
    description: input.description ?? null,
    requestedAt,
    receivedAt: reached("RECEIVED") ? stamp(10) : null,
    closedAt: reached("CLOSED") || stage === "CANCELLED" ? stamp(40) : null,
    closedReason:
      stage === "CANCELLED" ? (input.closedReason ?? "Cancelled") : null,
    updatedAt: input.updatedAt ?? stamp(50),
    experiments: [],
    events: [],
  };
  for (const m of methods) {
    const tpl =
      store.templates.find(
        (t) => t.sampleTypeId === st.id && t.name === m.name,
      ) ?? seedTemplate(st.name, m.name, { body: m.body });
    const context = clone(tpl.template);
    context.values = clone(m.values ?? {});
    ticket.experiments.push({
      id: randomUUID(),
      experimentTemplateId: tpl.id,
      templateName: tpl.name,
      startedAt: reached("IN_PROGRESS") ? stamp(20) : null,
      finishedAt: reached("COMPLETED") ? stamp(30) : null,
      contextVersion: 1,
      context,
      createdAt: requestedAt,
      updatedAt: requestedAt,
    });
  }
  event(ticket, "ticket.requested", input.requesterUserId, null);
  if (input.reportPublished)
    event(ticket, "ticket.report_published", input.requesterUserId, null);
  store.tickets.push(ticket);
  return ticket;
}

/** Fail the next write whose method and path match with `status` and `message`. */
export function failNextWrite(
  match: { method?: string; pathIncludes?: string } = {},
  status = 409,
  message = "rejected by the test",
) {
  store.failures.push({
    match: (ctx) =>
      ctx.method !== "GET" &&
      ctx.method !== "HEAD" &&
      (!match.method || ctx.method === match.method) &&
      (!match.pathIncludes || ctx.path.join("/").includes(match.pathIncludes)),
    status,
    message,
  });
}

// --- request handling ------------------------------------------------------------

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const bad = (m: string) => new HttpError(400, m);
const notFound = (m: string) => new HttpError(404, m);
const conflict = (m: string) => new HttpError(409, m);

const OWNED = ["sample-types", "experiment-templates", "tickets"];

function ownsPath(path: string[]) {
  if (OWNED.includes(path[0])) return true;
  return (
    path[0] === "users" &&
    path[2] === "notification-preferences" &&
    path.length === 3
  );
}

async function jsonBody(ctx: StubContext): Promise<Json> {
  const raw = (await ctx.readRaw()).toString("utf8");
  if (!raw) return {};
  try {
    const parsed = parseExact(raw);
    if (!isObject(parsed)) throw bad("body must be a JSON object");
    return parsed;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw bad("body must be valid JSON");
  }
}

function text(field: string, v: unknown): string {
  if (typeof v !== "string" || !v.trim())
    throw bad(`${field} must not be blank`);
  return v.trim();
}

function sampleType(id: string) {
  const st = store.sampleTypes.find((s) => s.id === id);
  if (!st) throw notFound("sample type not found");
  return st;
}
function template(id: string) {
  const t = store.templates.find((x) => x.id === id);
  if (!t) throw notFound("experiment template not found");
  return t;
}
function ticket(id: string) {
  const t = findTicket(id);
  if (!t) throw notFound("ticket not found");
  return t;
}

function checkOrder(ids: unknown, live: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) throw bad("order must list ids");
  if (new Set(ids).size !== ids.length)
    throw bad("order contains duplicate ids");
  if (ids.some((id) => !live.includes(id as string)))
    throw notFound("order contains unknown or incorrectly scoped ids");
  if (ids.length !== live.length)
    throw conflict("catalogue changed; refresh and try again");
  return ids as string[];
}

const sortedTypes = () =>
  [...store.sampleTypes].sort((a, b) => a.displayOrder - b.displayOrder);
const sortedTemplates = (typeId: string) =>
  store.templates
    .filter((t) => t.sampleTypeId === typeId)
    .sort((a, b) => a.displayOrder - b.displayOrder);

function validateTemplate(raw: unknown): Json {
  if (!isObject(raw)) throw bad("template must be a JSON object");
  const keys = Object.keys(raw).sort().join(", ");
  if (keys !== "calculations, clientForm, labForm")
    throw bad(
      `template must contain exactly calculations, clientForm, labForm (found: ${keys})`,
    );
  return raw;
}

async function readMultipart(ctx: StubContext): Promise<FormData> {
  const req = new Request("http://stub/", {
    method: "POST",
    headers: { "content-type": ctx.header("content-type") ?? "" },
    body: new Uint8Array(await ctx.readRaw()),
  });
  try {
    return await req.formData();
  } catch {
    throw bad("body must be a multipart form with file and/or fields");
  }
}

async function catalogue(ctx: StubContext, actor: string): Promise<boolean> {
  const { method, path } = ctx;
  const [root, id, sub, sub2] = path;

  if (root === "sample-types") {
    if (path.length === 1 && method === "GET")
      return ctx.json(200, sortedTypes().map(sampleTypeWire));
    if (path.length === 1 && method === "POST") {
      const body = await jsonBody(ctx);
      const st = seedSampleType(text("name", body.name), {
        description: (body.description as string | null) ?? undefined,
        visible: false,
        reportForm: false,
      });
      return ctx.json(201, sampleTypeWire(st));
    }
    if (id === "web-order" && path.length === 2 && method === "PUT") {
      const ids = checkOrder(
        (await jsonBody(ctx)).sampleTypeIds,
        store.sampleTypes.map((s) => s.id),
      );
      ids.forEach((x, i) => (sampleType(x).displayOrder = i + 1));
      return ctx.json(200, sortedTypes().map(sampleTypeWire));
    }
    const st = sampleType(id);
    if (path.length === 2 && method === "PUT") {
      const body = await jsonBody(ctx);
      st.name = text("name", body.name);
      st.description = (body.description as string | null) ?? null;
      st.updatedAt = now();
      return ctx.json(200, sampleTypeWire(st));
    }
    if (path.length === 2 && method === "DELETE") {
      store.sampleTypes.splice(store.sampleTypes.indexOf(st), 1);
      store.templates = store.templates.filter((t) => t.sampleTypeId !== st.id);
      return ctx.send(204, Buffer.alloc(0), "text/plain");
    }
    if (sub === "web-visibility" && method === "PATCH") {
      const v = (await jsonBody(ctx)).isVisibleOnWeb;
      if (typeof v !== "boolean") throw bad("isVisibleOnWeb is required");
      st.isVisibleOnWeb = v;
      return ctx.json(200, sampleTypeWire(st));
    }
    if (sub === "experiment-templates" && path.length === 3) {
      if (method === "GET") return ctx.json(200, sortedTemplates(st.id));
      if (method === "POST") {
        const body = await jsonBody(ctx);
        const at = now();
        const tpl: StTemplate = {
          id: randomUUID(),
          sampleTypeId: st.id,
          name: text("name", body.name),
          description: (body.description as string | null) ?? null,
          template: validateTemplate(body.template),
          isVisibleOnWeb: false,
          displayOrder: sortedTemplates(st.id).length + 1,
          createdAt: at,
          updatedAt: at,
        };
        store.templates.push(tpl);
        return ctx.json(201, tpl);
      }
    }
    if (
      sub === "experiment-templates" &&
      sub2 === "web-order" &&
      method === "PUT"
    ) {
      const live = sortedTemplates(st.id);
      const ids = checkOrder(
        (await jsonBody(ctx)).templateIds,
        live.map((t) => t.id),
      );
      ids.forEach((x, i) => (template(x).displayOrder = i + 1));
      return ctx.json(200, sortedTemplates(st.id));
    }
    if (sub === "report-form" && path.length === 3) {
      if (method === "GET" || method === "HEAD") {
        if (!st.reportPdf || !st.reportForm)
          throw notFound("sample type has no report form");
        return ctx.send(200, st.reportPdf, "application/pdf");
      }
      if (method === "PUT") {
        const form = await readMultipart(ctx);
        const file = form.get("file");
        const fields = form.get("fields");
        if (!file && fields === null) throw bad("file or fields is required");
        let pdf = st.reportPdf;
        if (file && typeof file !== "string") {
          pdf = Buffer.from(await file.arrayBuffer());
          if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
            throw bad("file is not a PDF");
        }
        if (!pdf) throw bad("upload the blank report form (file) first");
        let reportForm = st.reportForm ?? { fields: [] };
        if (typeof fields === "string") {
          const parsed = JSON.parse(fields) as { fields?: unknown[] };
          if (!Array.isArray(parsed.fields))
            throw bad("fields: fields is required");
          reportForm = { fields: parsed.fields };
        }
        st.reportPdf = pdf;
        st.reportForm = reportForm;
        st.updatedAt = now();
        return ctx.json(200, sampleTypeWire(st));
      }
    }
    return false;
  }

  if (root === "experiment-templates") {
    const tpl = template(id);
    if (path.length === 2 && method === "GET") return ctx.json(200, tpl);
    if (path.length === 2 && method === "PUT") {
      const body = await jsonBody(ctx);
      tpl.name = text("name", body.name);
      tpl.description = (body.description as string | null) ?? null;
      tpl.template = validateTemplate(body.template);
      tpl.updatedAt = now();
      return ctx.json(200, tpl);
    }
    if (path.length === 2 && method === "DELETE") {
      store.templates.splice(store.templates.indexOf(tpl), 1);
      return ctx.send(204, Buffer.alloc(0), "text/plain");
    }
    if (sub === "web-visibility" && method === "PATCH") {
      const v = (await jsonBody(ctx)).isVisibleOnWeb;
      if (typeof v !== "boolean") throw bad("isVisibleOnWeb is required");
      tpl.isVisibleOnWeb = v;
      return ctx.json(200, tpl);
    }
    return false;
  }
  void actor;
  return false;
}

/** Apply a values patch + results under the experiment (sample_tracker's contextBuilder). */
function applyValues(
  e: StExperiment,
  body: Json,
  requireResults: boolean,
  ticketRow: StTicket,
  actor: string,
) {
  const patch = body.values ?? {};
  if (!isObject(patch)) throw bad("values must be a JSON object");
  const sent = body.results ?? {};
  if (!isObject(sent)) throw bad("results must be a JSON object");
  if (
    body.version !== undefined &&
    body.version !== null &&
    Number(JSON.stringify(body.version)) !== e.contextVersion
  )
    throw conflict("values were changed by someone else; reload and try again");

  const oldValues = (e.context.values ?? {}) as Json;
  const merged = mergePatch(oldValues, patch) as Json;
  const valuesChanged = !same(oldValues, merged);
  const calcs = (e.context.calculations ?? {}) as Record<string, Json>;
  for (const key of Object.keys(sent))
    if (!calcs[key])
      throw bad(`results: ${key} is not a calculation of this experiment`);

  const nextCalcs: Record<string, Json> = {};
  const missing: string[] = [];
  for (const [key, calc] of Object.entries(calcs)) {
    let result = calc.result;
    if (key in sent) result = sent[key];
    else if (valuesChanged) result = "";
    nextCalcs[key] = { ...calc, result };
    const r = JSON.stringify(result);
    if (result === undefined || r === '""' || r === "null") missing.push(key);
  }
  const changed = valuesChanged || !same(calcs, nextCalcs);
  if (changed) {
    e.context = { ...e.context, values: merged, calculations: nextCalcs };
    e.contextVersion += 1;
    e.updatedAt = now();
    ticketRow.updatedAt = e.updatedAt;
    event(ticketRow, "experiment.values_saved", actor, e.id, {});
  }
  if (requireResults && missing.length)
    throw bad(`results missing for: ${missing.sort().join(", ")}`);
}

async function tickets(ctx: StubContext, actor: string): Promise<boolean> {
  const { method, path } = ctx;
  if (path.length === 1 && method === "POST") {
    const body = await jsonBody(ctx);
    const name = text("name", body.name);
    const st = sampleType(String(body.sampleTypeId));
    if (!st.isVisibleOnWeb)
      throw bad(
        "sampleTypeId is hidden from the catalogue and cannot be requested",
      );
    const ids = body.experimentTemplateIds;
    if (!Array.isArray(ids) || ids.length === 0)
      throw bad("experimentTemplateIds is required");
    if (new Set(ids).size !== ids.length)
      throw bad("experimentTemplateIds must not contain duplicates");
    const answers = (body.clientAnswers ?? {}) as Record<string, Json>;
    for (const k of Object.keys(answers))
      if (!ids.includes(k))
        throw bad(`clientAnswers.${k} is not a requested template`);
    const offered = ids.map((x) =>
      store.templates.find(
        (t) => t.id === x && t.isVisibleOnWeb && t.sampleTypeId === st.id,
      ),
    );
    const missing = ids.filter((_, i) => !offered[i]);
    if (missing.length)
      throw bad(
        `experimentTemplateIds has templates that are not offered for this sample type: ${missing.join(", ")}`,
      );
    const at = now();
    const row: StTicket = {
      id: randomUUID(),
      name,
      sampleTypeId: st.id,
      requesterUserId: actor,
      organizationId: String(body.organizationId),
      description: (body.description as string | null) ?? null,
      requestedAt: at,
      receivedAt: null,
      closedAt: null,
      closedReason: null,
      updatedAt: at,
      experiments: [],
      events: [],
    };
    for (const tpl of offered as StTemplate[]) {
      const context = clone(tpl.template);
      const given = answers[tpl.id] ?? {};
      const questions = (
        (context.clientForm as Json).questions as FormQuestion[]
      ).map((q) => q.id);
      for (const q of Object.keys(given))
        if (!questions.includes(q))
          throw bad(
            `clientAnswers.${tpl.id}.${q} is not a client form question`,
          );
      context.values = given;
      row.experiments.push({
        id: randomUUID(),
        experimentTemplateId: tpl.id,
        templateName: tpl.name,
        startedAt: null,
        finishedAt: null,
        contextVersion: 1,
        context,
        createdAt: at,
        updatedAt: at,
      });
    }
    event(row, "ticket.requested", actor, null, { experimentTemplateIds: ids });
    store.tickets.push(row);
    return ctx.json(201, ticketWire(row));
  }
  if (path.length === 1 && method === "GET") {
    const q = ctx.url.searchParams;
    const statuses = q.getAll("status");
    const by = q.get("sortBy") ?? "requestedAt";
    const desc = q.get("sortDir") !== "asc";
    const rows = store.tickets
      .filter(
        (t) =>
          !q.get("requesterUserId") ||
          t.requesterUserId === q.get("requesterUserId"),
      )
      .filter(
        (t) =>
          !q.get("organizationId") ||
          t.organizationId === q.get("organizationId"),
      )
      .filter(
        (t) => statuses.length === 0 || statuses.includes(ticketStatus(t)),
      )
      .sort((a, b) => {
        const key = by as "requestedAt" | "updatedAt" | "name";
        const c = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
        return desc ? -c : c;
      });
    const offset = Number(q.get("offset") ?? 0);
    const limit = Number(q.get("limit") ?? 100);
    return ctx.json(200, rows.slice(offset, offset + limit).map(summaryWire));
  }

  const t = ticket(path[1]);
  const status = ticketStatus(t);
  const open = () => {
    if (status === "CLOSED" || status === "CANCELLED")
      throw conflict("ticket is closed");
  };
  const touch = () => (t.updatedAt = now());

  if (path.length === 2 && method === "GET")
    return ctx.json(200, ticketWire(t));
  if (path[2] === "events" && method === "GET") return ctx.json(200, t.events);
  if (path[2] === "receive" && method === "POST") {
    open();
    if (status !== "REQUESTED") throw conflict("ticket is already received");
    t.receivedAt = now();
    touch();
    event(t, "ticket.received", actor, null);
    return ctx.json(200, ticketWire(t));
  }
  if (path[2] === "close" && method === "POST") {
    open();
    const body = await jsonBody(ctx);
    const reason =
      body.reason === undefined || body.reason === null
        ? null
        : text("reason", body.reason);
    if (!reason && status !== "COMPLETED")
      throw conflict("ticket is not completed; give a reason to cancel it");
    t.closedAt = now();
    t.closedReason = reason;
    touch();
    event(t, "ticket.closed", actor, null, reason ? { reason } : {});
    return ctx.json(200, ticketWire(t));
  }
  if (path[2] === "report" && path.length === 3) {
    const st = sampleType(t.sampleTypeId);
    if (method === "POST") {
      if (!st.reportPdf || !st.reportForm)
        throw notFound("sample type has no report form");
      if (status !== "COMPLETED" && status !== "CLOSED")
        throw conflict("ticket is not completed");
      touch();
      event(t, "ticket.report_published", actor, null);
      return ctx.json(200, ticketWire(t));
    }
    if (method === "GET") {
      if (!reportPublishedAt(t)) throw notFound("report is not published");
      if (!st.reportPdf) throw notFound("sample type has no report form");
      return ctx.send(
        200,
        makePdf([`Report: ${t.name}`, st.name]),
        "application/pdf",
      );
    }
  }
  if (path[2] === "experiments" && path.length === 5) {
    const e = t.experiments.find((x) => x.id === path[3]);
    if (!e) throw notFound("experiment not found");
    const es = experimentStatus(e);
    const op = path[4];
    open();
    if (op === "start" && method === "POST") {
      if (status === "REQUESTED")
        throw conflict("ticket has not been received");
      if (es !== "PENDING") throw conflict("experiment is already started");
      e.startedAt = now();
      e.updatedAt = e.startedAt;
      touch();
      event(t, "experiment.started", actor, e.id);
      return ctx.json(200, ticketWire(t));
    }
    if (op === "values" && method === "PATCH") {
      if (es === "PENDING") throw conflict("experiment has not been started");
      if (es === "FINISHED")
        throw conflict("experiment is finished; reopen it to change values");
      const body = await jsonBody(ctx);
      if (body.values === undefined && body.results === undefined)
        throw bad("values or results is required");
      applyValues(e, body, false, t, actor);
      return ctx.json(200, ticketWire(t));
    }
    if (op === "finish" && method === "POST") {
      if (es === "PENDING") throw conflict("experiment has not been started");
      if (es === "FINISHED") throw conflict("experiment is already finished");
      // One transaction: a refused finish writes nothing.
      const before = {
        e: clone(e),
        events: t.events.length,
        updatedAt: t.updatedAt,
      };
      try {
        applyValues(e, await jsonBody(ctx), true, t, actor);
      } catch (err) {
        Object.assign(e, before.e);
        t.events.length = before.events;
        t.updatedAt = before.updatedAt;
        throw err;
      }
      e.finishedAt = now();
      e.updatedAt = e.finishedAt;
      touch();
      event(t, "experiment.finished", actor, e.id);
      if (ticketStatus(t) === "COMPLETED")
        event(t, "ticket.completed", actor, null);
      return ctx.json(200, ticketWire(t));
    }
    if (op === "reopen" && method === "POST") {
      const reason = text("reason", (await jsonBody(ctx)).reason);
      if (es !== "FINISHED") throw conflict("experiment is not finished");
      e.finishedAt = null;
      e.updatedAt = now();
      touch();
      event(t, "experiment.reopened", actor, e.id, { reason });
      return ctx.json(200, ticketWire(t));
    }
  }
  return false;
}

async function preferences(ctx: StubContext): Promise<boolean> {
  const userId = ctx.path[1];
  const current = () => {
    const saved = store.preferences.get(userId) ?? [];
    return EMAIL_EVENTS.map(
      (eventType) =>
        saved.find((p) => p.eventType === eventType) ?? {
          eventType,
          emailEnabled: !eventType.startsWith("experiment."),
        },
    );
  };
  if (ctx.method === "GET") return ctx.json(200, { preferences: current() });
  if (ctx.method === "PUT") {
    const prefs = (await jsonBody(ctx)).preferences;
    if (!Array.isArray(prefs)) throw bad("preferences is required");
    for (const p of prefs as { eventType: string; emailEnabled: boolean }[]) {
      if (!EMAIL_EVENTS.includes(p.eventType))
        throw bad(`eventType ${p.eventType} is not emailable`);
    }
    const merged = new Map(current().map((p) => [p.eventType, p]));
    for (const p of prefs as { eventType: string; emailEnabled: boolean }[])
      merged.set(p.eventType, p);
    store.preferences.set(userId, [...merged.values()]);
    return ctx.json(200, { preferences: current() });
  }
  return false;
}

async function handle(ctx: StubContext): Promise<boolean> {
  if (!ownsPath(ctx.path)) return false;
  const write = !["GET", "HEAD", "OPTIONS"].includes(ctx.method);
  try {
    const actor = ctx.header("x-actor-user-id") ?? "";
    if (write) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          actor,
        )
      )
        throw bad("X-Actor-User-Id header must be a valid UUID");
      const failure = store.failures.findIndex((f) => f.match(ctx));
      if (failure >= 0) {
        const [f] = store.failures.splice(failure, 1);
        throw new HttpError(f.status, f.message);
      }
      const isJson = (ctx.header("content-type") ?? "").includes("json");
      store.writes.push({
        method: ctx.method,
        path: ctx.path.join("/"),
        body: isJson ? await ctx.readBody() : null,
      });
    }
    const handled =
      ctx.path[0] === "tickets"
        ? await tickets(ctx, actor)
        : ctx.path[0] === "users"
          ? await preferences(ctx)
          : await catalogue(ctx, actor);
    if (!handled)
      throw notFound(
        `sample_tracker stub: ${ctx.method} /${ctx.path.join("/")} is not a route`,
      );
    return true;
  } catch (err) {
    if (err instanceof HttpError)
      return ctx.json(err.status, { message: err.message });
    throw err;
  }
}

function reset() {
  store.sampleTypes = [];
  store.templates = [];
  store.tickets = [];
  store.preferences = new Map();
  store.eventSeq = 0;
  store.failures = [];
  store.writes = [];
  // Baseline specimen every scenario can open (the onboarding features start from it).
  seedSampleType("Coal", {
    description: "Raw coal samples for proximate analysis",
  });
}

registerStub({ name: "sample-tracker", priority: 100, reset, handle });
