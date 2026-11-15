import "server-only";

import {
  type DownstreamInit,
  DownstreamTimeoutError,
  loggedFetch,
} from "@/lib/log/downstream";

import { getSampleTrackerUrl } from "./config";

/** A failed sample_tracker call; `message` from the body is in `detail`. */
export class SampleTrackerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "SampleTrackerError";
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
  reportForm: { fields: ReportField[] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportField {
  page: number;
  x: number;
  y: number;
  size?: number;
  align?: "" | "left" | "center" | "right";
  prefix?: string;
  source: string;
}

export interface ExperimentTemplate {
  id: string;
  sampleTypeId: string;
  name: string;
  description: string | null;
  /** `{clientForm, labForm, calculations}` as stored. */
  template: Record<string, unknown>;
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

export interface PublishReport {
  reportNumber: string;
  orderNumber: string;
  client: { name: string; address: string; postcodeCity: string; taxId: string };
  authorizedBy: { name: string; title: string };
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
  const url = `${getSampleTrackerUrl()}${path}`;
  const { actor, ...rest } = init;
  let res: Response;
  try {
    res = await loggedFetch("sample-tracker", url, {
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
      throw new SampleTrackerError(
        `sample_tracker ${rest.method ?? "GET"} ${path} timed out`,
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
    throw new SampleTrackerError(
      `sample_tracker ${rest.method ?? "GET"} ${path} failed (${res.status})`,
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

/** One live sample type; a 404 SampleTrackerError when unknown or deleted. */
export async function getSampleType(actor: string | undefined, id: string): Promise<SampleType> {
  const found = (await listSampleTypes(actor)).find((st) => st.id === id);
  if (!found) throw new SampleTrackerError("sample type not found", 404, "sample type not found");
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

export const getReportForm = (actor: string | undefined, sampleTypeId: string) =>
  stBytes(`/sample-types/${sampleTypeId}/report-form`, { actor });

export function putReportForm(
  actor: string,
  sampleTypeId: string,
  pdf: Blob,
  fields: string,
) {
  const body = new FormData();
  body.append("file", pdf, "report-form.pdf");
  body.append("fields", fields);
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

export const publishReport = (actor: string, ticketId: string, body: PublishReport) =>
  command(actor, `/tickets/${ticketId}/report`, body);

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

/** A sample_tracker failure as a readable message: its own message when it sent one. */
export function sampleTrackerMessage(error: unknown, fallback: string): string {
  if (error instanceof SampleTrackerError && error.detail) {
    return `${fallback}\n${error.detail}`;
  }
  return fallback;
}
