import "server-only";

import {
  listExperimentTemplates,
  listSamples,
} from "@/lib/experiment-manager/client";
import { isRequestableTemplate } from "@/lib/experiment-manager/mappers";

/**
 * Laboratory-offer data for the public landing page: every specimen type the
 * labs support, each with the experiment methods (templates) defined for it.
 */

/**
 * Specimen names kept off the public homepage.
 */
const HIDDEN_SAMPLE_NAMES = new Set(["dev test only"]);

export interface OfferExperiment {
  id: string;
  name: string;
  description?: string;
}

export interface OfferSample {
  id: string;
  name: string;
  description?: string;
  experiments: OfferExperiment[];
}

/**
 * Loads the offer from Experiment Manager. Best-effort: returns `null` if the
 * service can't be reached (the landing section degrades to a friendly
 * fallback), and treats a sample whose templates fail to load as having no
 * methods rather than failing the whole page.
 */
export async function getLabOffer(): Promise<OfferSample[] | null> {
  try {
    const { samples } = await listSamples();
    // Drop hidden specimens before the fan-out.
    const visible = samples.filter(
      (sample) => !HIDDEN_SAMPLE_NAMES.has(sample.name.trim().toLowerCase()),
    );
    return await Promise.all(
      visible.map(async (sample): Promise<OfferSample> => {
        let experiments: OfferExperiment[] = [];
        try {
          const { experiments: templates } = await listExperimentTemplates(
            sample.id,
          );
          experiments = templates
            .filter(isRequestableTemplate)
            .map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description ?? undefined,
            }));
        } catch {
          experiments = [];
        }
        return {
          id: sample.id,
          name: sample.name,
          description: sample.description ?? undefined,
          experiments,
        };
      }),
    );
  } catch {
    return null;
  }
}
