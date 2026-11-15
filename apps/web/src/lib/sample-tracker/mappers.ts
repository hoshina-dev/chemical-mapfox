import type { ExperimentTemplate as FormTemplate } from "@repo/forms";

import type {
  ExperimentDetail,
  ExperimentTemplateDetail,
} from "@/lib/experiment-manager/client";
import {
  type ExperimentState,
  experimentDetailToState,
  type LoadedTemplate,
  mapCalculationsToApi,
  type TemplateSummary,
  templateDetailToLoaded,
} from "@/lib/experiment-manager/mappers";
import type { ExperimentTicket } from "@/lib/ticketing/tickets";

import type {
  ExperimentTemplate,
  Ticket,
  TicketExperiment,
  TicketSummary,
} from "./client";

// The pages keep their view models (LoadedTemplate, ExperimentState, ExperimentTicket);
// these adapters fill them from sample_tracker. Template versions are gone: a template
// is edited in place and tickets keep their frozen copy, so lineageId = id.

export function templateToLoaded(t: ExperimentTemplate): LoadedTemplate {
  return templateDetailToLoaded({
    ...(t.template as object),
    id: t.id,
    lineage_id: t.id,
    name: t.name,
    description: t.description,
    has_pdf_template: true, // reports are per sample type now
  } as unknown as ExperimentTemplateDetail);
}

/** A template row for the onboarding tables (visibility and order come later). */
export function toTemplateSummary(t: ExperimentTemplate): TemplateSummary {
  return {
    sampleId: t.sampleTypeId,
    templateId: t.id,
    lineageId: t.id,
    title: t.name,
    description: t.description ?? undefined,
    hasPdfTemplate: true,
    isVisibleOnWeb: true,
    displayOrder: 0,
  };
}

/** One experiment of a ticket as the workspace's experiment state. */
export function experimentToState(
  ticket: Pick<Ticket, "sampleTypeId">,
  e: TicketExperiment,
): ExperimentState {
  return experimentDetailToState({
    ...(e.context as object),
    id: e.id,
    sample_id: ticket.sampleTypeId,
    template_id: e.experimentTemplateId,
    report_status: null,
    report_generated_at: null,
    created_at: e.createdAt,
  } as unknown as ExperimentDetail);
}

/** A template body for sample_tracker from the builder's draft. */
export function templateBody(
  meta: { title: string; description?: string },
  template: FormTemplate,
) {
  return {
    name: meta.title,
    description: meta.description ?? null,
    template: {
      clientForm: template.clientForm,
      labForm: template.labForm,
      calculations: mapCalculationsToApi(template.calculations),
    },
  };
}

/** A ticket in the listing view model (contextId = ticket id). */
export function toExperimentTicket(t: TicketSummary | Ticket): ExperimentTicket {
  const experiments = "experiments" in t ? t.experiments : [];
  const started = experiments
    .map((e) => e.startedAt)
    .filter((at): at is string => Boolean(at))
    .sort();
  return {
    contextId: t.id,
    name: t.name,
    status: t.status,
    templateId: null,
    organizationId: t.organizationId,
    userId: t.requesterUserId,
    createdAt: t.requestedAt,
    updatedAt: t.updatedAt,
    sampleReceivedAt: t.receivedAt,
    experimentStartedAt: started[0] ?? null,
    resultsSubmittedAt: null,
    closedAt: t.closedAt,
    closedReason: t.closedReason,
  };
}

// A collaborative editing room is one experiment of one ticket. The room id rides in
// the existing `/internal/experiment/{contextId}/collab/*` routes as the contextId.
const ROOM_SEPARATOR = "_";

export const collabRoomId = (ticketId: string, experimentId: string) =>
  `${ticketId}${ROOM_SEPARATOR}${experimentId}`;

export function parseRoomId(
  room: string,
): { ticketId: string; experimentId: string } | null {
  const [ticketId, experimentId, ...rest] = room.split(ROOM_SEPARATOR);
  if (!ticketId || !experimentId || rest.length) return null;
  return { ticketId, experimentId };
}
