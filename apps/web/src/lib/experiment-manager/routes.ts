import type { TemplateRef } from "./mappers";

const BASE = "/internal/experiment";

export function experimentListingPath() {
  return `${BASE}/listing`;
}

export function experimentWorkspacePath(contextId: string) {
  return `${BASE}/${contextId}`;
}

export function experimentRawPath(contextId: string) {
  return `${BASE}/${contextId}/raw`;
}

export function experimentReportViewPath(contextId: string) {
  return `${BASE}/${contextId}/report`;
}

export function experimentReportDownloadPath(contextId: string) {
  return `${BASE}/${contextId}/report?download=1`;
}

/**
 * Sample check-in page (the target of the QR label printed by the requester).
 * Lab staff open it to confirm a shipped sample has arrived, transitioning the
 * ticket REQUESTED → PENDING ("Sample received").
 */
export function experimentCheckinPath(contextId: string) {
  return `${BASE}/checkin/${contextId}`;
}

export function onboardingPath() {
  return `${BASE}/onboarding`;
}

export function sampleOnboardingPath(sampleId: string) {
  return `${BASE}/onboarding/${sampleId}`;
}

export function newTemplatePath(sampleId?: string) {
  return sampleId
    ? `${BASE}/onboarding/new?sampleId=${encodeURIComponent(sampleId)}`
    : `${BASE}/onboarding/new`;
}

export function templateBuilderPath(ref: TemplateRef) {
  return `${BASE}/onboarding/${ref.sampleId}/${ref.templateId}`;
}

/** PDF report-layout designer for a template version. */
export function templatePdfPath(ref: TemplateRef) {
  return `${BASE}/onboarding/${ref.sampleId}/${ref.templateId}/pdf`;
}
