import "server-only";

import {
  listSampleTypes,
  listTemplates,
} from "@/lib/experiment-manager/client";

/**
 * Laboratory-offer data for the public landing page: the sample types and
 * methods (templates) staff show on the web, in their catalogue order.
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
 * Loads the offer from experiment-manager. Best-effort: returns `null` if the
 * service can't be reached (the landing section degrades to a friendly
 * fallback), and treats a sample whose templates fail to load as having no
 * methods rather than failing the whole page.
 */
export async function getLabOffer(): Promise<OfferSample[] | null> {
  try {
    const visible = (await listSampleTypes(undefined)).filter(
      (s) => s.isVisibleOnWeb,
    );
    return await Promise.all(
      visible.map(async (sample): Promise<OfferSample> => {
        let experiments: OfferExperiment[] = [];
        try {
          const templates = await listTemplates(undefined, sample.id);
          experiments = templates
            .filter((t) => t.isVisibleOnWeb)
            .map((t) => ({
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
