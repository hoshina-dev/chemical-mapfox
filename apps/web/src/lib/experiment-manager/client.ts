import "server-only";

import type { ExperimentManager } from "@repo/api-client";

import { loggedFetch } from "@/lib/log/downstream";

import { getExperimentManagerUrl } from "./config";

export class ExperimentManagerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ExperimentManagerError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function emFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getExperimentManagerUrl()}${path}`;
  const res = await loggedFetch("experiment-manager", url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Read the body once, keeping the raw text if it isn't JSON, so the failure
    // reason is never lost (FastAPI 422 -> JSON detail; gateway errors -> text).
    const text = await res.text().catch(() => "");
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    throw new ExperimentManagerError(
      `Experiment Manager ${init?.method ?? "GET"} ${path} failed (${res.status})`,
      res.status,
      body,
    );
  }

  if (res.status === 204) return undefined as T;
  return parseJson<T>(res);
}

type Em = ExperimentManager.Components["schemas"];

export type SampleSummary = Em["SampleSummary"];
export type SampleCreate = Em["SampleCreate"];
export type FormDocSnapshot = Em["FormDoc"];
export type CalculationSnapshot = Em["Calculation"];
export type ExperimentTemplateCreate = Em["ExperimentTemplateCreate"];
export type ExperimentTemplateUpdate = Em["ExperimentTemplateUpdate"];
export type ExperimentTemplateSummary = Em["ExperimentTemplateSummary"];
export type ExperimentCreate = Em["ExperimentCreate"];
export type ExperimentUpdate = Em["ExperimentUpdate"];
export type ReportStatusResponse = Em["ReportStatusResponse"];
export type ReportDownloadResponse = Em["ReportDownloadResponse"];
export type PdfTemplateBody = Em["PdfTemplateBody"];
export type PdfTemplateResponse = Em["PdfTemplateResponse"];
export type CalculationDryRunRequest = Em["CalculationDryRunRequest"];
export type CalculationDryRunResponse = Em["CalculationDryRunResponse"];
export type CalculationOutcome = Em["CalculationOutcome"];
export type CalculationErrorDetail = Em["CalculationError"];

/**
 * Fields merged from the experiment template JSONB. OpenAPI types the detail
 * response loosely; this narrows the known snapshot keys we read.
 */
export interface TemplateSnapshotFields {
  clientForm?: FormDocSnapshot | null;
  labForm?: FormDocSnapshot | null;
  calculations?: Record<string, CalculationSnapshot | string>;
}

export type ExperimentTemplateDetail = Em["ExperimentTemplateDetail"] &
  TemplateSnapshotFields;

/**
 * The experiment (context) detail merges the template snapshot plus the current
 * `values`. OpenAPI types it loosely (extra keys are `unknown`); this narrows
 * the snapshot/state keys the workspace reads.
 */
export type ExperimentDetail = Em["ExperimentDetail"] &
  TemplateSnapshotFields & {
    values?: Record<string, unknown> | null;
  };

// --- Samples ---

export async function listSamples() {
  return emFetch<{ samples: SampleSummary[] }>("/api/samples");
}

export async function getSample(sampleId: string) {
  return emFetch<SampleSummary>(`/api/samples/${sampleId}`);
}

export async function createSample(body: SampleCreate) {
  return emFetch<SampleSummary>("/api/samples", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Experiments (contexts) ---

export async function getExperiment(expId: string) {
  return emFetch<ExperimentDetail>(`/api/experiments/${expId}`);
}

export async function createExperiment(body: ExperimentCreate) {
  return emFetch<ExperimentDetail>("/api/experiments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateExperiment(expId: string, body: ExperimentUpdate) {
  return emFetch<ExperimentDetail>(`/api/experiments/${expId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Evaluate the experiment's `calculations` against its current `values`,
 * writing each `result` back. Returns the updated context. Idempotent — safe to
 * re-run whenever values change. Must precede report generation when the
 * template defines calculations (the PDF renders `{{var}}` from these results).
 */
export async function calculateExperiment(expId: string) {
  return emFetch<ExperimentDetail>(`/api/experiments/${expId}/calculate`, {
    method: "POST",
  });
}

/**
 * Replace an experiment's own calculation formulas in place — scoped to this
 * experiment only (doesn't touch template_id/version, doesn't fork a new
 * template version, doesn't affect other experiments on the same lineage).
 * Resets each formula's `result` to "" server-side; call `calculateExperiment`
 * afterward to recompute.
 */
export async function updateExperimentCalculations(
  expId: string,
  calculations: Record<string, { formula: string }>,
) {
  return emFetch<ExperimentDetail>(`/api/experiments/${expId}/calculations`, {
    method: "PUT",
    body: JSON.stringify({ calculations }),
  });
}

// --- Calculations (stateless dry run) ---

/**
 * Run a draft template's formulas against trial values without saving
 * anything — neither a template nor an experiment has to exist. Used by the
 * onboarding builder so an author can check their formulas before saving.
 *
 * Unlike `calculateExperiment`, a broken formula does not fail the request:
 * the response reports each calculation's own `status` (`ok` / `error` /
 * `skipped`), so all mistakes surface in one round trip.
 */
export async function evaluateCalculations(body: CalculationDryRunRequest) {
  return emFetch<CalculationDryRunResponse>("/api/calculations/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Queue PDF report generation (async; returns the queued status). The worker
 * renders from the experiment context and uploads to R2. Rejects with 409 while
 * a generation is already pending/processing.
 */
export async function generateReport(expId: string) {
  return emFetch<ReportStatusResponse>(
    `/api/experiments/${expId}/report/generate`,
    { method: "POST" },
  );
}

/** A short-lived presigned URL for the generated PDF. 404 until one exists. */
export async function getReportDownloadUrl(expId: string) {
  return emFetch<ReportDownloadResponse>(
    `/api/experiments/${expId}/report/download`,
  );
}

// --- Experiment templates (nested under a sample) ---

export async function listExperimentTemplates(sampleId: string) {
  return emFetch<{
    sample_id: string;
    experiments: ExperimentTemplateSummary[];
  }>(`/api/samples/${sampleId}/experiments`);
}

export async function getExperimentTemplate(
  sampleId: string,
  templateId: string,
) {
  return emFetch<ExperimentTemplateDetail>(
    `/api/samples/${sampleId}/experiments/${templateId}`,
  );
}

export async function createExperimentTemplate(
  sampleId: string,
  body: ExperimentTemplateCreate,
) {
  return emFetch<ExperimentTemplateDetail>(
    `/api/samples/${sampleId}/experiments`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function updateExperimentTemplate(
  sampleId: string,
  lineageId: string,
  body: ExperimentTemplateUpdate,
) {
  return emFetch<ExperimentTemplateDetail>(
    `/api/samples/${sampleId}/experiments/${lineageId}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function deleteExperimentTemplate(
  sampleId: string,
  templateId: string,
) {
  return emFetch<void>(`/api/samples/${sampleId}/experiments/${templateId}`, {
    method: "DELETE",
  });
}

// --- PDF report templates (the layout for a template's generated report) ---

/**
 * The PDF layout attached to a template's current version. `components` is the
 * ordered array authored against `docs/pdf-report-engine.md`. 404 until a
 * layout has been saved for the lineage.
 */
export async function getPdfTemplate(sampleId: string, templateId: string) {
  return emFetch<PdfTemplateResponse>(
    `/api/samples/${sampleId}/experiments/${templateId}/pdf`,
  );
}

/**
 * Create or replace the PDF layout for a template lineage. Addressed by
 * `lineageId` (not a specific version) — the backend attaches it to the current
 * version and returns the version it landed on via `template_id`.
 */
export async function upsertPdfTemplate(
  sampleId: string,
  lineageId: string,
  components: unknown[],
) {
  return emFetch<PdfTemplateResponse>(
    `/api/samples/${sampleId}/experiments/${lineageId}/pdf`,
    { method: "PUT", body: JSON.stringify({ components }) },
  );
}

export async function deletePdfTemplate(sampleId: string, templateId: string) {
  return emFetch<void>(
    `/api/samples/${sampleId}/experiments/${templateId}/pdf`,
    { method: "DELETE" },
  );
}
