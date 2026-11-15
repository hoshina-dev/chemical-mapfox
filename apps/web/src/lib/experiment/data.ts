import "server-only";

import type { LoadedTemplate } from "@/lib/experiment-manager/mappers";
import { logHandledError } from "@/lib/log/handled";
import {
  getTemplate,
  listSampleTypes,
  listTemplates,
  listTickets,
  SampleTrackerError,
} from "@/lib/sample-tracker/client";
import { templateToLoaded, toExperimentTicket } from "@/lib/sample-tracker/mappers";
import type { ExperimentTicket } from "@/lib/ticketing/tickets";

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
 * The catalogue of requestable experiments, grouped by sample type: the ones staff
 * show on the web, in catalogue order. Groups with no template are kept so the
 * lab's specimen coverage is visible.
 */
export async function listRequestCatalog(): Promise<CatalogGroup[]> {
  const samples = (await listSampleTypes(undefined)).filter(
    (s) => s.isVisibleOnWeb,
  );
  return Promise.all(
    samples.map(async (sample): Promise<CatalogGroup> => {
      let templates: CatalogTemplate[] = [];
      try {
        templates = (await listTemplates(undefined, sample.id))
          .filter((tpl) => tpl.isVisibleOnWeb)
          .map((tpl) => ({
            sampleId: sample.id,
            templateId: tpl.id,
            lineageId: tpl.id,
            title: tpl.name,
            description: tpl.description,
          }));
      } catch (error) {
        // A single specimen's templates failing shouldn't blank the catalogue.
        logHandledError(error, {
          op: "listRequestCatalog.templates",
          sampleId: sample.id,
          level: "warn",
        });
      }
      return {
        sampleId: sample.id,
        sampleName: sample.name,
        sampleDescription: sample.description,
        templates,
      };
    }),
  );
}

/** The template a request starts from, with every method of its sample type. */
export interface RequestTemplates {
  sampleId: string;
  sampleName: string;
  template: LoadedTemplate;
  /** The sample type's templates shown on the web, `template` included. */
  methods: LoadedTemplate[];
}

/**
 * Resolve a template for the request flow, with the other methods of its sample
 * type so the client can request several on one sample. null when unknown or
 * hidden (hidden ones cannot be requested).
 */
export async function loadRequestTemplate(
  templateId: string,
): Promise<RequestTemplates | null> {
  let tpl;
  try {
    tpl = await getTemplate(undefined, templateId);
  } catch (error) {
    if (error instanceof SampleTrackerError && error.status === 404) return null;
    throw error;
  }
  const [samples, siblings] = await Promise.all([
    listSampleTypes(undefined),
    listTemplates(undefined, tpl.sampleTypeId),
  ]);
  const sample = samples.find((s) => s.id === tpl.sampleTypeId);
  if (!sample?.isVisibleOnWeb || !tpl.isVisibleOnWeb) return null;
  return {
    sampleId: sample.id,
    sampleName: sample.name,
    template: templateToLoaded(tpl),
    methods: siblings.filter((m) => m.isVisibleOnWeb).map(templateToLoaded),
  };
}

/** One of the client's own tickets (one physical sample). */
export type MyExperiment = ExperimentTicket;

/** Every ticket the given user requested, most recently updated first. */
export async function listMyExperiments(
  userId: string,
): Promise<MyExperiment[]> {
  const rows = await listTickets(userId, { requesterUserId: userId });
  return rows.map(toExperimentTicket);
}
