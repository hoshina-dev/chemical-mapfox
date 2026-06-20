import "server-only";

import type { ExperimentManager } from "@repo/api-client";

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
  const res = await fetch(url, {
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
    // Log the raw response so the detail is visible in server logs even if the
    // UI can't format the body shape.
    console.error(
      `[experiment-manager] ${init?.method ?? "GET"} ${path} -> ${res.status}`,
      body ?? "(no body)",
    );
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
