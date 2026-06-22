import "server-only";

import {
  ExperimentManagerError,
  getExperimentTemplate,
  listExperimentTemplates,
  listSamples,
} from "@/lib/experiment-manager/client";
import {
  type LoadedTemplate,
  templateDetailToLoaded,
} from "@/lib/experiment-manager/mappers";
import { ticketsApi } from "@/lib/ticketing/client";
import { type ExperimentTicket, toExperimentTicket } from "@/lib/ticketing/tickets";

/** A requestable template within a specimen (sample) group. */
export interface CatalogTemplate {
  sampleId: string;
  templateId: string;
  lineageId: string;
  title: string;
  description: string | null;
}

/** A specimen (sample) and the current templates a client can request for it. */
export interface CatalogGroup {
  sampleId: string;
  sampleName: string;
  sampleDescription: string | null;
  templates: CatalogTemplate[];
}

/**
 * The full catalogue of requestable experiments, grouped by specimen. Only the
 * **current** version of each template is offered; groups with no current
 * template are kept (with an empty list) so the lab's specimen coverage is
 * visible. Sorted by specimen name for a stable, browsable listing.
 */
export async function listRequestCatalog(): Promise<CatalogGroup[]> {
  const { samples } = await listSamples();
  const groups = await Promise.all(
    samples.map(async (sample): Promise<CatalogGroup> => {
      let templates: CatalogTemplate[] = [];
      try {
        const { experiments } = await listExperimentTemplates(sample.id);
        templates = experiments
          .filter((tpl) => tpl.is_current)
          .map((tpl) => ({
            sampleId: sample.id,
            templateId: tpl.id,
            lineageId: tpl.lineage_id,
            title: tpl.name,
            description: tpl.description ?? null,
          }))
          .sort((a, b) => a.title.localeCompare(b.title));
      } catch {
        // A single specimen's templates failing shouldn't blank the catalogue.
        templates = [];
      }
      return {
        sampleId: sample.id,
        sampleName: sample.name,
        sampleDescription: sample.description ?? null,
        templates,
      };
    }),
  );
  return groups.sort((a, b) => a.sampleName.localeCompare(b.sampleName));
}

/**
 * Resolve a template for the onboarding flow. When the sample id is known (it
 * rides along as a query param from the catalogue) we load it directly;
 * otherwise we sweep the specimens to find which one owns the template.
 */
export async function loadRequestTemplate(
  templateId: string,
  sampleId?: string,
): Promise<{ sampleId: string; template: LoadedTemplate } | null> {
  if (sampleId) {
    try {
      const detail = await getExperimentTemplate(sampleId, templateId);
      return { sampleId, template: templateDetailToLoaded(detail) };
    } catch (error) {
      if (
        error instanceof ExperimentManagerError &&
        error.status === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  const { samples } = await listSamples();
  for (const sample of samples) {
    try {
      const { experiments } = await listExperimentTemplates(sample.id);
      if (experiments.some((tpl) => tpl.id === templateId)) {
        const detail = await getExperimentTemplate(sample.id, templateId);
        return { sampleId: sample.id, template: templateDetailToLoaded(detail) };
      }
    } catch {
      // Keep scanning the remaining specimens.
    }
  }
  return null;
}

/** One of the client's own experiments, sourced directly from ticketing. */
export type MyExperiment = ExperimentTicket;

/**
 * Every experiment the given user has requested, newest first. Ticketing owns
 * the display name so this listing does not fan out to Experiment Manager.
 */
export async function listMyExperiments(userId: string): Promise<MyExperiment[]> {
  const rows = await ticketsApi.apiV1TicketsGet(
    userId,
    undefined,
    undefined,
    "updated_at",
    "desc",
  );
  return rows.map(toExperimentTicket);
}
