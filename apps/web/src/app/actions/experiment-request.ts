"use server";

import type { AnswerValue } from "@repo/forms";
import { FormAnswers, validateAnswers } from "@repo/forms";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { requireClient } from "@/lib/auth/dal";
import { CHEMFOX_ORG_ID } from "@/lib/custapi/chemfoxOrg";
import {
  createExperiment,
  updateExperiment,
} from "@/lib/experiment-manager/client";
import { templateToExperimentUpdate } from "@/lib/experiment-manager/mappers";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { myExperimentsPath } from "@/lib/experiment/routes";
import { formatAnswerIssues } from "@/lib/forms/answerIssues";
import { logHandledError } from "@/lib/log/handled";
import { ticketsApi } from "@/lib/ticketing/client";

interface RequestExperimentInput {
  sampleId: string;
  templateId: string;
  /** Client intake answers, keyed by question id. */
  values: Record<string, AnswerValue>;
}

async function errorText(error: unknown, fallback: string): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response instanceof Response
  ) {
    try {
      const body = (await error.response.clone().json()) as {
        error?: string;
        message?: string;
        detail?: string;
      };
      const message = body.error ?? body.message ?? body.detail;
      if (message) return `${fallback}\n${message}`;
    } catch {
      // fall through
    }
  }
  if (error instanceof Error && error.message) return `${fallback}\n${error.message}`;
  return fallback;
}

/**
 * Submit a client experiment request from a template. Creates the ticket (the
 * experiment **context**), then best-effort seeds the experiment-manager context
 * with the template snapshot + the client's intake answers so the lab sees them
 * immediately. The ticket is the hard requirement; the EM seeding is reported
 * via `warning` but never fails the request (the lab can re-enter values, and
 * the backend may already create the context on its own).
 */
export async function requestExperimentAction(
  input: RequestExperimentInput,
): Promise<ActionResult<{ contextId: string; warning?: string }>> {
  const session = await requireClient();
  const t = await getTranslations("experiment.request.errors");
  const tIssue = await getTranslations("forms.validation");

  const resolved = await loadRequestTemplate(input.templateId, input.sampleId);
  if (!resolved) {
    return { success: false, error: t("templateGone") };
  }
  if (!resolved.template.hasPdfTemplate) {
    return { success: false, error: t("noReportLayout") };
  }

  // A server action's arguments are client-controlled: re-check the answer bag
  // is even shaped like answers before validating it question by question.
  const values = FormAnswers.safeParse(input.values);
  if (!values.success) {
    return { success: false, error: tIssue("invalidPayload") };
  }

  // Full enforcement of the template's own data types and ranges — the client
  // renderer checks the same rules, but the BFF is the one that must hold.
  // `rejectUnknownFields` is safe here because the intake payload may only
  // answer this template's client form.
  const issues = validateAnswers(
    resolved.template.template.clientForm.questions,
    values.data,
    { rejectUnknownFields: true },
  );
  if (issues.length > 0) {
    return {
      success: false,
      error: `${t("submitFailed")}\n${formatAnswerIssues(tIssue, issues)}`,
    };
  }

  let contextId: string;
  try {
    const ticket = await ticketsApi.apiV1TicketsPost({
      experimentTemplateId: input.templateId,
      name: resolved.template.meta.title,
      organizationId: CHEMFOX_ORG_ID,
      userId: session.userId,
    });
    if (!ticket.id) {
      return {
        success: false,
        error: t("noTicketId"),
      };
    }
    contextId = ticket.id;
  } catch (error) {
    logHandledError(error, { action: "requestExperimentAction", service: "ticketing" });
    return {
      success: false,
      error: await errorText(error, t("submitFailed")),
    };
  }

  // Best-effort: create the EM context and persist the client's intake answers.
  let warning: string | undefined;
  try {
    await createExperiment({
      exp_id: contextId,
      sample_id: resolved.sampleId,
      lineage_id: resolved.template.lineageId,
    });
  } catch (error) {
    // The context may already be created by the ticketing backend; ignore.
    logHandledError(error, {
      action: "requestExperimentAction",
      op: "createExperiment",
      contextId,
      expected: true,
    });
  }
  try {
    await updateExperiment(
      contextId,
      templateToExperimentUpdate(resolved.template.wireSnapshot, values.data),
    );
  } catch (error) {
    logHandledError(error, {
      action: "requestExperimentAction",
      op: "saveIntake",
      contextId,
      level: "warn",
    });
    warning = t("intakeNotSaved");
  }

  revalidatePath(myExperimentsPath());
  return { success: true, data: { contextId, warning } };
}
