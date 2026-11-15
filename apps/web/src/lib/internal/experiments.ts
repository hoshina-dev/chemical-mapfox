import "server-only";

import { usersApi } from "@/lib/custapi/client";
import type { ExperimentState } from "@/lib/experiment/templates";
import { logHandledError } from "@/lib/log/handled";
import {
  type ExperimentStatus,
  getTicket,
  listSampleTypes,
  listTickets,
  SampleTrackerError,
  type Ticket,
} from "@/lib/sample-tracker/client";
import { experimentToState, toExperimentTicket } from "@/lib/sample-tracker/mappers";
import type { ExperimentTicket } from "@/lib/experiment/tickets";

export interface Requester {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** A ticket joined with its requester for the staff listing. */
export interface EnrichedTicket extends ExperimentTicket {
  sampleType: string | null;
  /** Display title: the ticket name (the sample type's name at request). */
  experimentTitle: string | null;
  requester: Requester | null;
  /** "finished/total" methods. */
  progress: { finished: number; total: number };
}

function toRequester(user: {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}): Requester | null {
  if (!user.id) return null;
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

async function loadRequesterIndex(): Promise<Map<string, Requester>> {
  const users = await usersApi.usersGet();
  const index = new Map<string, Requester>();
  for (const user of users) {
    const requester = toRequester(user);
    if (requester) index.set(requester.id, requester);
  }
  return index;
}

async function sampleTypeNames(): Promise<Map<string, string>> {
  try {
    return new Map((await listSampleTypes(undefined)).map((st) => [st.id, st.name]));
  } catch (error) {
    logHandledError(error, { op: "sampleTypeNames", service: "sample-tracker", level: "warn" });
    return new Map();
  }
}

/**
 * All tickets for the staff listing, with requester info from one best-effort
 * custapi lookup.
 */
export async function listExperimentsForStaff(): Promise<{
  tickets: EnrichedTicket[];
  enrichmentDegraded: boolean;
}> {
  const [rows, names] = await Promise.all([listTickets(undefined), sampleTypeNames()]);

  let requesterIndex: Map<string, Requester> | null = null;
  try {
    requesterIndex = await loadRequesterIndex();
  } catch (error) {
    logHandledError(error, {
      op: "listExperimentsForStaff.requesters",
      service: "custapi",
      level: "warn",
    });
  }

  const tickets: EnrichedTicket[] = rows.map((row) => ({
    ...toExperimentTicket(row),
    sampleType: names.get(row.sampleTypeId) ?? null,
    experimentTitle: row.name,
    requester: requesterIndex?.get(row.requesterUserId) ?? null,
    progress: { finished: row.finished, total: row.total },
  }));
  return { tickets, enrichmentDegraded: requesterIndex === null };
}

/** One experiment (method) of the ticket in the workspace. */
export interface WorkspaceExperiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  contextVersion: number;
  startedAt: string | null;
  finishedAt: string | null;
  state: ExperimentState;
}

export interface ExperimentWorkspace {
  contextId: string;
  ticket: ExperimentTicket | null;
  /** The ticket as sample_tracker returned it (raw view, report state). */
  raw: Ticket | null;
  requester: Requester | null;
  sampleType: string | null;
  experimentTitle: string | null;
  experiments: WorkspaceExperiment[];
  /** The selected experiment (or the first one still open). */
  selected: WorkspaceExperiment | null;
  /** The selected experiment's state, as before (one experiment per page). */
  state: ExperimentState | null;
  errors: { ticket?: string; state?: string };
}

async function loadRequester(userId: string): Promise<Requester | null> {
  try {
    return toRequester(await usersApi.usersIdIdGet(userId));
  } catch (error) {
    logHandledError(error, { op: "loadRequester", service: "custapi", userId, level: "warn" });
    return null;
  }
}

/**
 * Everything a ticket page needs: the ticket, the requester, the sample type and
 * every experiment with its state. `experimentId` picks the experiment shown;
 * otherwise the first one not finished. A missing ticket leaves `ticket` null.
 */
export async function getExperimentWorkspace(
  contextId: string,
  experimentId?: string,
): Promise<ExperimentWorkspace> {
  const errors: ExperimentWorkspace["errors"] = {};
  let raw: Ticket | null = null;
  try {
    raw = await getTicket(undefined, contextId);
  } catch (error) {
    if (!(error instanceof SampleTrackerError && error.status === 404)) {
      logHandledError(error, { op: "getExperimentWorkspace.ticket", contextId });
      errors.ticket = error instanceof Error ? error.message : "Failed to load ticket.";
    }
  }
  if (!raw) {
    return {
      contextId,
      ticket: null,
      raw: null,
      requester: null,
      sampleType: null,
      experimentTitle: null,
      experiments: [],
      selected: null,
      state: null,
      errors,
    };
  }

  const published = raw.reportPublishedAt;
  const experiments: WorkspaceExperiment[] = raw.experiments.map((e) => ({
    id: e.id,
    name: e.templateName,
    status: e.status,
    contextVersion: e.contextVersion,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    state: {
      ...experimentToState(raw, e),
      reportStatus: published ? "success" : null,
      reportGeneratedAt: published,
    },
  }));
  const selected =
    experiments.find((e) => e.id === experimentId) ??
    experiments.find((e) => e.status !== "FINISHED") ??
    experiments[0] ??
    null;
  const [names, requester] = await Promise.all([
    sampleTypeNames(),
    loadRequester(raw.requesterUserId),
  ]);
  return {
    contextId,
    ticket: toExperimentTicket(raw),
    raw,
    requester,
    sampleType: names.get(raw.sampleTypeId) ?? null,
    experimentTitle: raw.name,
    experiments,
    selected,
    state: selected?.state ?? null,
    errors,
  };
}
