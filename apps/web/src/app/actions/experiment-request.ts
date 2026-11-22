"use server";

import { FormAnswers, validateAnswers } from "@repo/forms";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { ActionResult } from "@/app/actions/onboarding";
import { requireClient } from "@/lib/auth/dal";
import { CHEMFOX_ORG_ID } from "@/lib/custapi/chemfoxOrg";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { myExperimentsPath } from "@/lib/experiment/routes";
import { formatAnswerIssues } from "@/lib/forms/answerIssues";
import { logHandledError } from "@/lib/log/handled";
import { createTicket, experimentManagerMessage } from "@/lib/experiment-manager/client";

interface RequestExperimentInput {
  /** The method the request started from; its sample type is the ticket's. */
  templateId: string;
  /** Every method requested on this sample (templateId included). */
  templateIds: string[];
  /** Each method's intake answers (its own client form): method id → question id → answer. */
  values: Record<string, FormAnswers>;
  /** Made once per request form: a retry of this request returns the same ticket. */
  requestKey: string;
}

const REQUEST_KEY = /^[A-Za-z0-9-]{8,200}$/;
const MethodAnswers = z.record(z.string(), FormAnswers);

/**
 * Request one ticket (one physical sample) with the chosen methods. Each method's
 * intake answers are checked against that method's own client form, then stored
 * with its experiment in experiment-manager. The requester is the session user.
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

  // A server action's arguments are client-controlled: re-check the answers are
  // shaped like answers and belong to requested methods, then validate each
  // method's answers against its own client form.
  const values = MethodAnswers.safeParse(input.values);
  if (!values.success || Object.keys(values.data).some((id) => !chosen.some((m) => m.id === id))) {
    return { success: false, error: tIssue("invalidPayload") };
  }
  const answersOf = (id: string) => values.data[id] ?? {};
  const answers = Object.fromEntries(chosen.map((m) => [m.id, answersOf(m.id)]));
  const problems = chosen.flatMap((m) => {
    const issues = validateAnswers(m.template.clientForm.questions, answersOf(m.id), {
      rejectUnknownFields: true,
    });
    return issues.length > 0 ? [`${m.meta.title}\n${formatAnswerIssues(tIssue, issues)}`] : [];
  });
  if (problems.length > 0) {
    return { success: false, error: `${t("submitFailed")}\n${problems.join("\n")}` };
  }

  try {
    const requestKey = REQUEST_KEY.test(input.requestKey) ? input.requestKey : undefined;
    const ticket = await createTicket(session.userId, {
      name: resolved.sampleName,
      sampleTypeId: resolved.sampleId,
      organizationId: CHEMFOX_ORG_ID,
      experimentTemplateIds: chosen.map((m) => m.id),
      clientAnswers: answers,
    }, requestKey);
    revalidatePath(myExperimentsPath());
    return { success: true, data: { contextId: ticket.id } };
  } catch (error) {
    logHandledError(error, { action: "requestExperimentAction", service: "experiment-manager" });
    return { success: false, error: experimentManagerMessage(error, t("submitFailed")) };
  }
}
