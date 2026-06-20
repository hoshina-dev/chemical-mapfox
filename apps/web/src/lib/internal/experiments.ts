import "server-only";

import { usersApi } from "@/lib/custapi/client";
import {
  ExperimentManagerError,
  getExperiment,
  listExperimentTemplates,
  listSamples,
} from "@/lib/experiment-manager/client";
import {
  type ExperimentState,
  experimentDetailToState,
} from "@/lib/experiment-manager/mappers";
import { ticketsApi } from "@/lib/ticketing/client";
import { type ExperimentTicket, toExperimentTicket } from "@/lib/ticketing/tickets";

export interface Requester {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** A ticket joined with the experiment title/sample type and its requester. */
export interface EnrichedTicket extends ExperimentTicket {
  sampleType: string | null;
  experimentTitle: string | null;
  requester: Requester | null;
}

interface TemplateInfo {
  sampleType: string;
  title: string;
}

/**
 * Index of every experiment template keyed by both its version id and lineage
 * id (a ticket may reference either), mapping to its sample type + title.
 * One samples sweep — cheap enough for an internal listing.
 */
async function loadTemplateIndex(): Promise<Map<string, TemplateInfo>> {
  const { samples } = await listSamples();
  const index = new Map<string, TemplateInfo>();
  await Promise.all(
    samples.map(async (sample) => {
      const { experiments } = await listExperimentTemplates(sample.id);
      for (const tpl of experiments) {
        const info: TemplateInfo = { sampleType: sample.name, title: tpl.name };
        index.set(tpl.id, info);
        index.set(tpl.lineage_id, info);
      }
    }),
  );
  return index;
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

/**
 * All experiment tickets for the staff listing, joined with template/sample and
 * requester info. The ticket fetch is required; the joins are best-effort so
 * the listing still renders (with blanks) if EM or custapi is unreachable.
 */
export async function listExperimentsForStaff(): Promise<{
  tickets: EnrichedTicket[];
  enrichmentDegraded: boolean;
}> {
  const rows = await ticketsApi.apiV1TicketsGet(
    undefined,
    undefined,
    undefined,
    "updated_at",
    "desc",
  );
  const base = rows.map(toExperimentTicket);

  const [tplResult, userResult] = await Promise.allSettled([
    loadTemplateIndex(),
    loadRequesterIndex(),
  ]);
  const templateIndex =
    tplResult.status === "fulfilled" ? tplResult.value : null;
  const requesterIndex =
    userResult.status === "fulfilled" ? userResult.value : null;

  const tickets: EnrichedTicket[] = base.map((ticket) => {
    const info = ticket.templateId
      ? (templateIndex?.get(ticket.templateId) ?? null)
      : null;
    const requester = ticket.userId
      ? (requesterIndex?.get(ticket.userId) ?? null)
      : null;
    return {
      ...ticket,
      sampleType: info?.sampleType ?? null,
      experimentTitle: info?.title ?? null,
      requester,
    };
  });

  return {
    tickets,
    enrichmentDegraded: templateIndex === null || requesterIndex === null,
  };
}

export interface ExperimentWorkspace {
  contextId: string;
  ticket: ExperimentTicket | null;
  requester: Requester | null;
  sampleType: string | null;
  experimentTitle: string | null;
  state: ExperimentState | null;
  errors: { ticket?: string; state?: string };
}

async function loadRequester(userId: string): Promise<Requester | null> {
  try {
    return toRequester(await usersApi.usersIdIdGet(userId));
  } catch {
    return null;
  }
}

/**
 * Everything the (non-realtime) experiment workspace needs: the ticket, the
 * requester, the resolved title/sample type, and the current experiment state
 * (forms + entered values). Each source is best-effort and reported via
 * `errors`, so the page degrades gracefully when a backend is unreachable or
 * the experiment context hasn't been created yet.
 */
export async function getExperimentWorkspace(
  contextId: string,
): Promise<ExperimentWorkspace> {
  const errors: ExperimentWorkspace["errors"] = {};

  const [ticketResult, stateResult, tplResult] = await Promise.allSettled([
    ticketsApi.apiV1TicketsIdGet(contextId),
    getExperiment(contextId),
    loadTemplateIndex(),
  ]);

  let ticket: ExperimentTicket | null = null;
  if (ticketResult.status === "fulfilled") {
    ticket = toExperimentTicket(ticketResult.value);
  } else {
    errors.ticket =
      ticketResult.reason instanceof Error
        ? ticketResult.reason.message
        : "Failed to load ticket.";
  }

  let state: ExperimentState | null = null;
  if (stateResult.status === "fulfilled") {
    state = experimentDetailToState(stateResult.value);
  } else if (
    stateResult.reason instanceof ExperimentManagerError &&
    stateResult.reason.status === 404
  ) {
    // No experiment context exists for this id yet — an expected state for a
    // ticket whose experiment hasn't been created. Leave `state` null without
    // recording an error so the page shows the friendly empty state.
  } else {
    errors.state =
      stateResult.reason instanceof Error
        ? stateResult.reason.message
        : "Failed to load experiment state.";
  }

  const templateIndex =
    tplResult.status === "fulfilled" ? tplResult.value : null;
  const templateId = state?.templateId ?? ticket?.templateId ?? null;
  const info = templateId ? (templateIndex?.get(templateId) ?? null) : null;

  const requester = ticket?.userId ? await loadRequester(ticket.userId) : null;

  return {
    contextId,
    ticket,
    requester,
    sampleType: info?.sampleType ?? null,
    experimentTitle: info?.title ?? null,
    state,
    errors,
  };
}
