const BASE = "/experiment";

/** The client's own experiments (board view). */
export function myExperimentsPath() {
  return `${BASE}/listing`;
}

/** Read-only detail for one of the client's experiments. */
export function myExperimentDetailPath(contextId: string) {
  return `${BASE}/listing/${contextId}`;
}

export function myExperimentReportViewPath(contextId: string) {
  return `${BASE}/listing/${contextId}/report`;
}

export function myExperimentReportDownloadPath(contextId: string) {
  return `${BASE}/listing/${contextId}/report?download=1`;
}

/** Catalogue of requestable specimens/templates. */
export function requestCatalogPath() {
  return `${BASE}/request/listing`;
}

/**
 * The request form for one sample, starting from `templateId`; `methods` are
 * the other methods of the same sample type to tick in advance.
 */
export function requestTemplatePath(templateId: string, methods: string[] = []) {
  const others = methods.filter((id) => id !== templateId);
  return others.length > 0
    ? `${BASE}/request/${templateId}?methods=${others.map(encodeURIComponent).join(",")}`
    : `${BASE}/request/${templateId}`;
}

/** @deprecated Use `settingsPath` from `@/lib/settings/routes`. */
export { settingsPath } from "@/lib/settings/routes";
