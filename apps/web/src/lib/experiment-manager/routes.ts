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
