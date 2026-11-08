import "server-only";

import {
  type AnswerIssue,
  type AnswerValue,
  describeAnswerIssue,
  type Question,
  validateField,
} from "@repo/forms";

import type { ActionResult } from "@/app/actions/experiment-manager";
import {
  applyEdit,
  flushNow,
  hydrate,
  publish,
  readLocks,
  readPresence,
  readTemplate,
  scheduleFlush,
} from "@/lib/collab/room";
import { getExperiment } from "@/lib/experiment-manager/client";
import { logHandledError } from "@/lib/log/handled";
import { ticketsApi } from "@/lib/ticketing/client";

import { updateFinalizingValues } from "./workflow";

export interface LabValuesResult {
  stage: "EXPERIMENTING" | "FINALIZING";
  saved: string[];
}

/** Top-level question that owns `field`: itself, or a repeatable group for a child id. */
function lockOwnerField(questions: Question[], field: string): string {
  for (const q of questions) {
    if (q.type === "repeatable-group" && q.config.questions.some((c) => c.id === field)) {
      return q.id;
    }
  }
  return field;
}

function issueText(issues: AnswerIssue[]): string {
  return issues.map(describeAnswerIssue).join(" ");
}

/**
 * Writes lab-form answers on behalf of an MCP client, all-or-nothing.
 *
 * - EXPERIMENTING: goes through the collaborative editor's Redis buffer and
 *   pub/sub, so staff with the workspace open see the values live. Fields
 *   someone is editing right now are refused rather than overwritten.
 * - FINALIZING: the same "fix values" path as the workspace's fix dialog.
 *
 * `null` clears a field. Required-field checks are left to submit, since a
 * partial update can't satisfy them.
 */
export async function recordLabValues(
  contextId: string,
  values: Record<string, AnswerValue>,
  connectionId: string,
): Promise<ActionResult<LabValuesResult>> {
  let status: string | undefined;
  try {
    status = (await ticketsApi.apiV1TicketsIdGet(contextId)).status;
  } catch (error) {
    logHandledError(error, { op: "mcp.recordLabValues.ticket", contextId });
    return { success: false, error: "Could not load this experiment's ticket." };
  }

  if (status === "FINALIZING") {
    try {
      const exp = await getExperiment(contextId);
      const merged: Record<string, AnswerValue> = {
        ...(exp.values as Record<string, AnswerValue> | undefined),
      };
      for (const [field, value] of Object.entries(values)) {
        if (value === null) delete merged[field];
        else merged[field] = value;
      }
      const res = await updateFinalizingValues(contextId, merged);
      if (!res.success) return res;
    } catch (error) {
      logHandledError(error, { op: "mcp.recordLabValues.finalizing", contextId });
      return { success: false, error: "Could not load the experiment's current values." };
    }
    return { success: true, data: { stage: "FINALIZING", saved: Object.keys(values) } };
  }

  if (status !== "EXPERIMENTING") {
    return {
      success: false,
      error: `Lab values can only be recorded while the experiment is EXPERIMENTING or FINALIZING (it is ${status ?? "unknown"}).`,
    };
  }

  try {
    await hydrate(contextId);
  } catch (error) {
    logHandledError(error, { op: "mcp.recordLabValues.hydrate", contextId });
    return { success: false, error: "Could not load the experiment's lab form." };
  }
  const template = await readTemplate(contextId);
  if (!template) {
    return { success: false, error: "Could not load the experiment's lab form." };
  }
  const questions = template.labForm.questions;

  const [locks, presence] = await Promise.all([
    readLocks(contextId),
    readPresence(contextId),
  ]);
  const names = new Map(presence.map((p) => [p.connectionId, p.name]));

  const problems: string[] = [];
  for (const [field, value] of Object.entries(values)) {
    const issues = validateField(questions, field, value, "submit");
    if (issues === null) {
      problems.push(`${field}: not a question in this lab form.`);
      continue;
    }
    const blocking = issues.filter((issue) => issue.code !== "required");
    if (blocking.length > 0) problems.push(`${field}: ${issueText(blocking)}`);

    const owner = locks[lockOwnerField(questions, field)];
    if (owner && owner !== connectionId) {
      const who = names.get(owner) ?? "another staff member";
      problems.push(`${field}: ${who} is editing this field right now; try again shortly.`);
    }
  }
  if (problems.length > 0) {
    return { success: false, error: `Nothing was saved.\n${problems.join("\n")}` };
  }

  for (const [field, value] of Object.entries(values)) {
    await applyEdit(contextId, field, value);
    await publish(contextId, { type: "edit", field, value, by: connectionId });
  }
  try {
    if (!(await flushNow(contextId))) scheduleFlush(contextId);
  } catch (error) {
    // The buffer holds the values; the debounced flush retries the write.
    logHandledError(error, { op: "mcp.recordLabValues.flush", contextId });
    scheduleFlush(contextId);
  }
  return { success: true, data: { stage: "EXPERIMENTING", saved: Object.keys(values) } };
}
