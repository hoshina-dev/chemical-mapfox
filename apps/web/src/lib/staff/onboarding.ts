import "server-only";

import type { ExperimentTemplate } from "@repo/forms";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/onboarding";
import { onboardingPath, sampleOnboardingPath } from "@/lib/internal/routes";
import { logHandledError } from "@/lib/log/handled";
import {
  createSampleType,
  createTemplate,
  getTemplate,
  listSampleTypes,
  experimentManagerMessage,
  setSampleTypeWebVisibility,
  setTemplateWebVisibility,
  updateTemplate,
} from "@/lib/experiment-manager/client";
import { templateBody } from "@/lib/experiment-manager/mappers";

import { inspectFormulas } from "./formulas";

// Method onboarding for the MCP tools. Formulas are only checked statically:
// running them is the browser's job (a person tests them on the builder page).

export interface OnboardInput {
  sampleId?: string;
  sampleName?: string;
  sampleDescription?: string;
  title: string;
  description?: string;
  /** Revise this template instead of creating one (it keeps its sample type). */
  templateId?: string;
  template: ExperimentTemplate;
  /** Also show the sample type and the method on the public catalogue. */
  publish?: boolean;
}

export interface OnboardedTemplate {
  sampleId: string;
  sampleName: string;
  createdSample: boolean;
  templateId: string;
  published: boolean;
  warning?: string;
}

export function refreshOnboarding(sampleId?: string) {
  revalidatePath("/");
  revalidatePath("/experiment/request/listing");
  revalidatePath(onboardingPath());
  if (sampleId) revalidatePath(sampleOnboardingPath(sampleId));
}

function failure(
  error: unknown,
  fallback: string,
  op: string,
): ActionResult<never> {
  logHandledError(error, { op });
  return { success: false, error: experimentManagerMessage(error, fallback) };
}

/** The sample type by id, else by name (case-insensitive), created when the name is new. */
async function resolveSample(
  actor: string,
  input: OnboardInput,
): Promise<ActionResult<{ id: string; name: string; created: boolean }>> {
  const samples = await listSampleTypes(actor);
  if (input.sampleId) {
    const sample = samples.find((s) => s.id === input.sampleId);
    if (!sample)
      return { success: false, error: `No sample with id ${input.sampleId}.` };
    return {
      success: true,
      data: { id: sample.id, name: sample.name, created: false },
    };
  }
  const name = input.sampleName?.trim();
  if (!name) return { success: false, error: "Give sampleId or sampleName." };
  const existing = samples.find(
    (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (existing)
    return {
      success: true,
      data: { id: existing.id, name: existing.name, created: false },
    };
  const created = await createSampleType(actor, {
    name,
    description: input.sampleDescription?.trim() || null,
  });
  return {
    success: true,
    data: { id: created.id, name: created.name, created: true },
  };
}

/** Create or revise a method from forms and formulas the caller extracted. */
export async function onboardTemplate(
  actor: string,
  input: OnboardInput,
): Promise<ActionResult<OnboardedTemplate>> {
  const meta = {
    title: input.title.trim(),
    description: input.description?.trim(),
  };
  if (!meta.title)
    return { success: false, error: "Template title is required." };
  // Results belong to experiments, never to a template.
  const template: ExperimentTemplate = {
    ...input.template,
    calculations: Object.fromEntries(
      Object.entries(input.template.calculations).map(([name, { formula }]) => [
        name,
        { formula },
      ]),
    ),
  };
  const issues = inspectFormulas(template);
  if (issues.length > 0) {
    return {
      success: false,
      error: issues.map((issue) => issue.message).join("\n"),
    };
  }

  let sample: { id: string; name: string; created: boolean };
  let templateId: string;
  try {
    if (input.templateId) {
      const saved = await updateTemplate(
        actor,
        input.templateId,
        templateBody(meta, template),
      );
      const name = (await listSampleTypes(actor)).find(
        (s) => s.id === saved.sampleTypeId,
      )?.name;
      sample = { id: saved.sampleTypeId, name: name ?? "", created: false };
      templateId = saved.id;
    } else {
      const resolved = await resolveSample(actor, input);
      if (!resolved.success) return resolved;
      sample = resolved.data;
      templateId = (
        await createTemplate(actor, sample.id, templateBody(meta, template))
      ).id;
    }
  } catch (error) {
    return failure(
      error,
      "Could not save this template.",
      "onboardTemplate.save",
    );
  }

  let published = false;
  let warning: string | undefined;
  if (input.publish === true) {
    try {
      await setSampleTypeWebVisibility(actor, sample.id, true);
      await setTemplateWebVisibility(actor, templateId, true);
      published = true;
    } catch (error) {
      logHandledError(error, {
        op: "onboardTemplate.publish",
        sampleId: sample.id,
      });
      warning = experimentManagerMessage(
        error,
        "The template was saved, but it was not published.",
      );
    }
  }

  refreshOnboarding(sample.id);
  return {
    success: true,
    data: {
      sampleId: sample.id,
      sampleName: sample.name,
      createdSample: sample.created,
      templateId,
      published,
      warning,
    },
  };
}

/** Show or hide a sample type, or one of its templates. */
export async function setCatalogueVisibility(
  actor: string,
  sampleId: string,
  templateId: string | undefined,
  visible: boolean,
): Promise<ActionResult<null>> {
  try {
    if (templateId) {
      const template = await getTemplate(actor, templateId);
      if (template.sampleTypeId !== sampleId) {
        return {
          success: false,
          error: `Template ${templateId} is not under sample ${sampleId}.`,
        };
      }
      await setTemplateWebVisibility(actor, templateId, visible);
    } else {
      await setSampleTypeWebVisibility(actor, sampleId, visible);
    }
    return { success: true, data: null };
  } catch (error) {
    return failure(
      error,
      "Could not change the catalogue.",
      "setCatalogueVisibility",
    );
  } finally {
    refreshOnboarding(sampleId);
  }
}
