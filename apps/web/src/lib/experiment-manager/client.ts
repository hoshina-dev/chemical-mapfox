import "server-only";

import {
  type DownstreamInit,
  DownstreamTimeoutError,
  loggedFetch,
} from "@/lib/log/downstream";

import { getExperimentManagerUrl } from "./config";

/** A failed experiment-manager call; `message` from the body is in `detail`. */
export class ExperimentManagerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ExperimentManagerError";
  }
}

export type TicketStatus =
  | "REQUESTED"
  | "RECEIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

export type ExperimentStatus = "PENDING" | "IN_PROGRESS" | "FINISHED";

export interface SampleType {
  id: string;
  name: string;
  description: string | null;
  /** The report's results table; null until a blank form is uploaded. */
  reportForm: ReportForm | null;
  /** Offered in the catalogues; new sample types start hidden. */
  isVisibleOnWeb: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A sample type's results table: one section per method, in the order they print. */
export interface ReportForm {
  sections: ReportSection[];
}

/** One method (experiment template) and the results it prints. */
export interface ReportSection {
  template: string;
  rows: ReportRow[];
}

/** One printed result: a calculation of the section's method, as stored. */
export interface ReportRow {
  result: string;
  label?: string;
  unit?: string;
}

export interface ExperimentTemplate {
  id: string;
  sampleTypeId: string;
  name: string;
  description: string | null;
  /** `{clientForm, labForm, calculations}` as stored. */
  template: Record<string, unknown>;
  /** Offered in the catalogues; new templates start hidden. */
  isVisibleOnWeb: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSummary {
  id: string;
  name: string;
  sampleTypeId: string;
  requesterUserId: string;
  organizationId: string;
  description: string | null;
  status: TicketStatus;
  total: number;
  started: number;
  finished: number;
  requestedAt: string;
  receivedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  reportPublishedAt: string | null;
  updatedAt: string;
}

export interface TicketExperiment {
  id: string;
  experimentTemplateId: string;
  templateName: string;
  status: ExperimentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  contextVersion: number;
  /** `{clientForm, labForm, calculations, values}`. */
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket extends TicketSummary {
  experiments: TicketExperiment[];
}

export interface TicketEvent {
  id: number;
  type: string;
  experimentId: string | null;
  actorUserId: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface NotificationPreference {
  eventType: string;
  emailEnabled: boolean;
}

interface Init extends DownstreamInit {
  /** The acting user, sent as X-Actor-User-Id (required on writes; reads may omit it). */
  actor?: string;
}

async function request(path: string, init: Init): Promise<Response> {
  const url = `${getExperimentManagerUrl()}${path}`;
  const { actor, ...rest } = init;
  let res: Response;
  try {
    res = await loggedFetch("experiment-manager", url, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(actor ? { "X-Actor-User-Id": actor } : {}),
        ...(typeof rest.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        ...rest.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DownstreamTimeoutError) {
      throw new ExperimentManagerError(
        `experiment-manager ${rest.method ?? "GET"} ${path} timed out`,
        504,
      );
    }
    throw error;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail: string | undefined;
    try {
      detail = (JSON.parse(text) as { message?: string }).message;
    } catch {
      detail = text || undefined;
    }
    throw new ExperimentManagerError(
      `experiment-manager ${rest.method ?? "GET"} ${path} failed (${res.status})`,
      res.status,
      detail,
    );
  }
  return res;
}

/** JSON call; 204 resolves to undefined. */
export async function stFetch<T>(path: string, init: Init): Promise<T> {
  const res = await request(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** The raw body of a call (PDF downloads). */
export async function stBytes(path: string, init: Init): Promise<ArrayBuffer> {
  return (await request(path, init)).arrayBuffer();
}

const json = (body: unknown) => JSON.stringify(body);

// --- catalogue ---------------------------------------------------------------

export const listSampleTypes = (actor: string | undefined) =>
  stFetch<SampleType[]>("/sample-types", { actor });

/** One live sample type; a 404 ExperimentManagerError when unknown or deleted. */
export async function getSampleType(actor: string | undefined, id: string): Promise<SampleType> {
  const found = (await listSampleTypes(actor)).find((st) => st.id === id);
  if (!found) throw new ExperimentManagerError("sample type not found", 404, "sample type not found");
  return found;
}

export const createSampleType = (
  actor: string,
  body: { name: string; description?: string | null },
) => stFetch<SampleType>("/sample-types", { actor, method: "POST", body: json(body) });

export const updateSampleType = (
  actor: string,
  id: string,
  body: { name: string; description?: string | null },
) =>
  stFetch<SampleType>(`/sample-types/${id}`, { actor, method: "PUT", body: json(body) });

export const deleteSampleType = (actor: string, id: string) =>
  stFetch<void>(`/sample-types/${id}`, { actor, method: "DELETE" });

export const listTemplates = (actor: string | undefined, sampleTypeId: string) =>
  stFetch<ExperimentTemplate[]>(`/sample-types/${sampleTypeId}/experiment-templates`, {
    actor,
  });

export const getTemplate = (actor: string | undefined, id: string) =>
  stFetch<ExperimentTemplate>(`/experiment-templates/${id}`, { actor });

export interface TemplateBody {
  name: string;
  description?: string | null;
  template: Record<string, unknown>;
}

export const createTemplate = (actor: string, sampleTypeId: string, body: TemplateBody) =>
  stFetch<ExperimentTemplate>(`/sample-types/${sampleTypeId}/experiment-templates`, {
    actor,
    method: "POST",
    body: json(body),
  });

export const updateTemplate = (actor: string, id: string, body: TemplateBody) =>
  stFetch<ExperimentTemplate>(`/experiment-templates/${id}`, {
    actor,
    method: "PUT",
    body: json(body),
  });

export const deleteTemplate = (actor: string, id: string) =>
  stFetch<void>(`/experiment-templates/${id}`, { actor, method: "DELETE" });

// Catalogue web settings: a hidden sample type or template is not listed in the
// public catalogues and cannot be requested. Orders list every item once.

export const setSampleTypeWebVisibility = (actor: string, id: string, isVisibleOnWeb: boolean) =>
  stFetch<SampleType>(`/sample-types/${id}/web-visibility`, {
    actor,
    method: "PATCH",
    body: json({ isVisibleOnWeb }),
  });

export const setTemplateWebVisibility = (actor: string, id: string, isVisibleOnWeb: boolean) =>
  stFetch<ExperimentTemplate>(`/experiment-templates/${id}/web-visibility`, {
    actor,
    method: "PATCH",
    body: json({ isVisibleOnWeb }),
  });

export const setSampleTypesWebOrder = (actor: string, sampleTypeIds: string[]) =>
  stFetch<SampleType[]>("/sample-types/web-order", {
    actor,
    method: "PUT",
    body: json({ sampleTypeIds }),
  });

export const setTemplatesWebOrder = (actor: string, sampleTypeId: string, templateIds: string[]) =>
  stFetch<ExperimentTemplate[]>(`/sample-types/${sampleTypeId}/experiment-templates/web-order`, {
    actor,
    method: "PUT",
    body: json({ templateIds }),
  });

export const getReportForm = (actor: string | undefined, sampleTypeId: string) =>
  stBytes(`/sample-types/${sampleTypeId}/report-form`, { actor });

/** Whether the sample type's blank report form (PDF) is stored. HEAD: nothing is downloaded. */
export async function hasReportForm(actor: string | undefined, sampleTypeId: string): Promise<boolean> {
  try {
    await request(`/sample-types/${sampleTypeId}/report-form`, { actor, method: "HEAD" });
    return true;
  } catch (error) {
    if (error instanceof ExperimentManagerError && error.status === 404) return false;
    throw error;
  }
}

/**
 * Store the blank form and/or the results table; a part left out is kept (the table
 * alone needs a stored PDF, a first PDF alone starts with an empty table).
 */
export function putReportForm(
  actor: string,
  sampleTypeId: string,
  parts: { pdf?: Blob; form?: ReportForm },
) {
  const body = new FormData();
  if (parts.pdf) body.append("file", parts.pdf, "report-form.pdf");
  if (parts.form) body.append("fields", json(parts.form));
  return stFetch<SampleType>(`/sample-types/${sampleTypeId}/report-form`, {
    actor,
    method: "PUT",
    body,
  });
}

// --- tickets -----------------------------------------------------------------

export interface CreateTicket {
  name: string;
  sampleTypeId: string;
  organizationId: string;
  description?: string | null;
  experimentTemplateIds: string[];
  clientAnswers?: Record<string, Record<string, unknown>>;
}

export const createTicket = (actor: string, body: CreateTicket) =>
  stFetch<Ticket>("/tickets", { actor, method: "POST", body: json(body) });

export function listTickets(
  actor: string | undefined,
  query: { requesterUserId?: string; status?: TicketStatus[]; limit?: number } = {},
) {
  const q = new URLSearchParams({ sortBy: "updatedAt", sortDir: "desc" });
  if (query.requesterUserId) q.set("requesterUserId", query.requesterUserId);
  for (const s of query.status ?? []) q.append("status", s);
  q.set("limit", String(query.limit ?? 500));
  return stFetch<TicketSummary[]>(`/tickets?${q}`, { actor });
}

export const getTicket = (actor: string | undefined, id: string) =>
  stFetch<Ticket>(`/tickets/${id}`, { actor });

/** The ticket as sent, unparsed: numbers keep their text (5.0 stays a float for Python). */
export const getTicketText = async (id: string) =>
  (await request(`/tickets/${id}`, {})).text();

export const listTicketEvents = (actor: string | undefined, id: string) =>
  stFetch<TicketEvent[]>(`/tickets/${id}/events`, { actor });

const command = (actor: string, path: string, body?: unknown) =>
  stFetch<Ticket>(path, {
    actor,
    method: "POST",
    body: body === undefined ? undefined : json(body),
  });

export const receiveTicket = (actor: string, id: string) =>
  command(actor, `/tickets/${id}/receive`);

export const closeTicket = (actor: string, id: string, reason?: string) =>
  command(actor, `/tickets/${id}/close`, reason ? { reason } : undefined);

const exp = (ticketId: string, experimentId: string) =>
  `/tickets/${ticketId}/experiments/${experimentId}`;

export const startExperiment = (actor: string, ticketId: string, experimentId: string) =>
  command(actor, `${exp(ticketId, experimentId)}/start`);

/** `values` is an RFC 7386 merge patch; `results` the browser-computed results. */
export interface ValuesBody {
  values?: Record<string, unknown>;
  results?: Record<string, unknown>;
  version?: number;
}

export const saveValues = (
  actor: string,
  ticketId: string,
  experimentId: string,
  body: ValuesBody,
) =>
  stFetch<Ticket>(`${exp(ticketId, experimentId)}/values`, {
    actor,
    method: "PATCH",
    body: json(body),
  });

export const finishExperiment = (
  actor: string,
  ticketId: string,
  experimentId: string,
  body: ValuesBody,
) => command(actor, `${exp(ticketId, experimentId)}/finish`, body);

export const reopenExperiment = (
  actor: string,
  ticketId: string,
  experimentId: string,
  reason: string,
) => command(actor, `${exp(ticketId, experimentId)}/reopen`, { reason });

/** The sample type's report drawn with sample values (the report form editor's preview). */
export const previewReportForm = (actor: string | undefined, sampleTypeId: string) =>
  stBytes(`/sample-types/${sampleTypeId}/report-form/preview`, { actor });

/**
 * Issue the ticket's report from its current data (emails the requester). Publishing
 * again issues anew; downloads print the latest.
 */
export const publishReport = (actor: string, ticketId: string) =>
  command(actor, `/tickets/${ticketId}/report`);

/** What publishing would issue now; nothing is recorded, nobody is emailed. */
export const previewReport = (actor: string | undefined, ticketId: string) =>
  stBytes(`/tickets/${ticketId}/report/preview`, { actor });

/** The issued report. */
export const getReport = (actor: string | undefined, ticketId: string) =>
  stBytes(`/tickets/${ticketId}/report`, { actor });

// --- notification preferences ------------------------------------------------

export const getNotificationPreferences = async (actor: string | undefined, userId: string) =>
  (
    await stFetch<{ preferences: NotificationPreference[] }>(
      `/users/${userId}/notification-preferences`,
      { actor },
    )
  ).preferences;

export const setNotificationPreferences = (
  actor: string,
  userId: string,
  preferences: NotificationPreference[],
) =>
  stFetch<{ preferences: NotificationPreference[] }>(`/users/${userId}/notification-preferences`, {
    actor,
    method: "PUT",
    body: json({ preferences }),
  });

/** A experiment-manager failure as a readable message: its own message when it sent one. */
export function experimentManagerMessage(error: unknown, fallback: string): string {
  if (error instanceof ExperimentManagerError && error.detail) {
    return `${fallback}\n${error.detail}`;
  }
  return fallback;
}
