const BASE = "/experiment";

/** The client's own experiments (board view). */
export function myExperimentsPath() {
  return `${BASE}/listing`;
}

/** Read-only detail for one of the client's experiments. */
export function myExperimentDetailPath(contextId: string) {
  return `${BASE}/listing/${contextId}`;
}

/** Catalogue of requestable specimens/templates. */
export function requestCatalogPath() {
  return `${BASE}/request/listing`;
}

/**
 * Onboarding flow for a template. The template id is the route segment; the
 * sample id rides along as a query param so the page can load the template
 * directly (templates are addressed by sample + template id) without sweeping
 * every sample first.
 */
export function requestTemplatePath(templateId: string, sampleId?: string) {
  return sampleId
    ? `${BASE}/request/${templateId}?sampleId=${encodeURIComponent(sampleId)}`
    : `${BASE}/request/${templateId}`;
}
