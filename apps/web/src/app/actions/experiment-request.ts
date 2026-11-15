"use server";

import type { AnswerValue } from "@repo/forms";
import { FormAnswers, validateAnswers } from "@repo/forms";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { requireClient } from "@/lib/auth/dal";
import { CHEMFOX_ORG_ID } from "@/lib/custapi/chemfoxOrg";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { answersFor, mergeClientForms } from "@/lib/experiment/intake";
import { myExperimentsPath } from "@/lib/experiment/routes";
import { formatAnswerIssues } from "@/lib/forms/answerIssues";
import { logHandledError } from "@/lib/log/handled";
import { createTicket, sampleTrackerMessage } from "@/lib/sample-tracker/client";

interface RequestExperimentInput {
  /** The method the request started from; its sample type is the ticket's. */
  templateId: string;
  /** Every method requested on this sample (templateId included). */
  templateIds: string[];
  /** Intake answers of the merged client form, keyed by question id. */
  values: Record<string, AnswerValue>;
}

/**
 * Request one ticket (one physical sample) with the chosen methods. The intake
 * answers are checked against the merged client form, then stored per method in
 * sample_tracker with the ticket. The requester is the session user.
 */
export async function requestExperimentAction(
  input: RequestExperimentInput,
): Promise<ActionResult<{ contextId: string; warning?: string }>> {
  const session = await requireClient();
  const t = await getTranslations("experiment.request.errors");
  const tIssue = await getTranslations("forms.validation");

  const resolved = await loadRequestTemplate(input.templateId);
  if (!resolved) {
    return { success: false, error: t("templateGone") };
  }
  const chosen = resolved.methods.filter((m) => input.templateIds.includes(m.id));
  if (chosen.length === 0 || chosen.length !== new Set(input.templateIds).size) {
    return { success: false, error: t("templateGone") };
  }

  // A server action's arguments are client-controlled: re-check the answer bag
  // is shaped like answers, then validate it question by question.
  const values = FormAnswers.safeParse(input.values);
  if (!values.success) {
    return { success: false, error: tIssue("invalidPayload") };
  }
  const intake = mergeClientForms(
    chosen.map((m) => m.template.clientForm),
    resolved.sampleName,
  );
  const issues = validateAnswers(intake.questions, values.data, {
    rejectUnknownFields: true,
  });
  if (issues.length > 0) {
    return {
      success: false,
      error: `${t("submitFailed")}\n${formatAnswerIssues(tIssue, issues)}`,
    };
  }

  try {
    const ticket = await createTicket(session.userId, {
      name: resolved.sampleName,
      sampleTypeId: resolved.sampleId,
      organizationId: CHEMFOX_ORG_ID,
      experimentTemplateIds: chosen.map((m) => m.id),
      clientAnswers: Object.fromEntries(
        chosen.map((m) => [m.id, answersFor(m.template.clientForm, values.data)]),
      ),
    });
    revalidatePath(myExperimentsPath());
    return { success: true, data: { contextId: ticket.id } };
  } catch (error) {
    logHandledError(error, { action: "requestExperimentAction", service: "sample-tracker" });
    return { success: false, error: sampleTrackerMessage(error, t("submitFailed")) };
  }
}
