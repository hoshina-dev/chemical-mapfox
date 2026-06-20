"use server";

import type { AnswerValue } from "@repo/forms";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { requireClient } from "@/lib/auth/dal";
import { usersApi } from "@/lib/custapi/client";
import {
  createExperiment,
  updateExperiment,
} from "@/lib/experiment-manager/client";
import { templateToExperimentUpdate } from "@/lib/experiment-manager/mappers";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { myExperimentsPath } from "@/lib/experiment/routes";
import { ticketsApi } from "@/lib/ticketing/client";

interface RequestExperimentInput {
  sampleId: string;
  templateId: string;
  /** Client intake answers, keyed by question id. */
  values: Record<string, AnswerValue>;
}

async function resolveOrganizationId(
  userId: string,
  sessionOrgId: string | undefined,
): Promise<string | undefined> {
  if (sessionOrgId) return sessionOrgId;
  try {
    const memberships = await usersApi.usersIdIdOrganizationsGet(userId);
    return memberships.find((m) => m.organizationId)?.organizationId;
  } catch {
    return undefined;
  }
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

  const organizationId = await resolveOrganizationId(
    session.userId,
    session.organizationId,
  );
  if (!organizationId) {
    return {
      success: false,
      error:
        "You aren't a member of any organization yet, so this experiment can't be requested. Join an organization and try again.",
    };
  }

  const resolved = await loadRequestTemplate(input.templateId, input.sampleId);
  if (!resolved) {
    return { success: false, error: "That experiment template no longer exists." };
  }

  let contextId: string;
  try {
    const ticket = await ticketsApi.apiV1TicketsPost({
      experimentTemplateId: input.templateId,
      organizationId,
      userId: session.userId,
    });
    if (!ticket.id) {
      return {
        success: false,
        error: "The ticketing service returned a request without an id.",
      };
    }
    contextId = ticket.id;
  } catch (error) {
    return {
      success: false,
      error: await errorText(error, "Could not submit your experiment request."),
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
  } catch {
    // The context may already be created by the ticketing backend; ignore.
  }
  try {
    await updateExperiment(
      contextId,
      templateToExperimentUpdate(resolved.template.template, input.values),
    );
  } catch {
    warning =
      "Your request was submitted, but saving your intake answers didn't go through. The lab may ask you to re-enter them.";
  }

  revalidatePath(myExperimentsPath());
  return { success: true, data: { contextId, warning } };
}
