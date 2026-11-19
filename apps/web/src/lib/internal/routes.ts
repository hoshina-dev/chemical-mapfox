import type { TemplateRef } from "@/lib/experiment/templates";

const BASE = "/internal/experiment";

/**
 * Canonical experiment listing for lab staff — the default landing page for
 * admin (technician) sessions after sign-in.
 */
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

/** What publishing would issue now (nothing recorded, no email). */
export function experimentReportPreviewPath(contextId: string) {
  return `${BASE}/${contextId}/report/preview`;
}

/**
 * Sample check-in page (the target of the QR label printed by the requester).
 * Lab staff open it to confirm a shipped sample has arrived, transitioning the
 * ticket REQUESTED → RECEIVED ("Sample received").
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

/** The sample type's report form (blank PDF + results table). */
export function reportFormPath(sampleId: string) {
  return `${BASE}/onboarding/${sampleId}/report-form`;
}
