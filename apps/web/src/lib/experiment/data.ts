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

interface TemplateInfo {
  sampleType: string;
  title: string;
}

/**
 * Index of every template keyed by both version id and lineage id (a ticket may
 * reference either), mapping to its specimen + title. One samples sweep.
 */
async function loadTemplateInfoIndex(): Promise<Map<string, TemplateInfo>> {
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

/** One of the client's own experiments, enriched with its title/specimen. */
export interface MyExperiment extends ExperimentTicket {
  sampleType: string | null;
  experimentTitle: string | null;
}

/**
 * Every experiment the given user has requested, newest first, enriched with
 * the template title + specimen. The ticket fetch is required; the title/
 * specimen join is best-effort so the list still renders if EM is unreachable.
 */
export async function listMyExperiments(userId: string): Promise<{
  experiments: MyExperiment[];
  enrichmentDegraded: boolean;
}> {
  const rows = await ticketsApi.apiV1TicketsGet(
    userId,
    undefined,
    undefined,
    "updated_at",
    "desc",
  );
  const base = rows.map(toExperimentTicket);

  let templateIndex: Map<string, TemplateInfo> | null = null;
  try {
    templateIndex = await loadTemplateInfoIndex();
  } catch {
    templateIndex = null;
  }

  const experiments: MyExperiment[] = base.map((ticket) => {
    const info = ticket.templateId
      ? (templateIndex?.get(ticket.templateId) ?? null)
      : null;
    return {
      ...ticket,
      sampleType: info?.sampleType ?? null,
      experimentTitle: info?.title ?? null,
    };
  });

  return { experiments, enrichmentDegraded: templateIndex === null };
}
