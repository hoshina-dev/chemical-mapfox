import "server-only";

import { listSampleTypes, listTemplates } from "@/lib/sample-tracker/client";

/**
 * Laboratory-offer data for the public landing page: every specimen type the
 * labs support, each with the experiment methods (templates) defined for it.
 */

export interface OfferExperiment {
  canRequest: boolean;
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
 * Loads the offer from sample_tracker. Best-effort: returns `null` if the
 * service can't be reached (the landing section degrades to a friendly
 * fallback), and treats a sample whose templates fail to load as having no
 * methods rather than failing the whole page.
 */
export async function getLabOffer(): Promise<OfferSample[] | null> {
  try {
    // TODO(catalogue visibility): filter once sample_tracker has visibility.
    const visible = await listSampleTypes(undefined);
    return await Promise.all(
      visible.map(async (sample): Promise<OfferSample> => {
        let experiments: OfferExperiment[] = [];
        try {
          const templates = await listTemplates(undefined, sample.id);
          experiments = templates.map((t) => ({
              id: t.id,
              canRequest: true,
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
