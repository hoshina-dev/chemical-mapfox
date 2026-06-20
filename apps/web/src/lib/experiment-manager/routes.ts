import type { TemplateRef } from "./mappers";

const BASE = "/internal/experiment";

export function onboardingPath() {
  return `${BASE}/onboarding`;
}

export function newTemplatePath() {
  return `${BASE}/onboarding/new`;
}

export function templateBuilderPath(ref: TemplateRef) {
  return `${BASE}/onboarding/${ref.sampleId}/${ref.templateId}`;
}
