import "server-only";

import {
  type AnswerValue,
  describeAnswerIssue,
  type Question,
  validateField,
} from "@repo/forms";

import type { ActionResult } from "@/app/actions/onboarding";
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
import { logHandledError } from "@/lib/log/handled";
import { getTicket } from "@/lib/experiment-manager/client";
import { collabRoomId } from "@/lib/experiment-manager/mappers";

/** Top-level question that owns `field`'s lock: itself, or the repeatable group of a child id. */
function lockOwnerField(questions: Question[], field: string): string {
  for (const q of questions) {
    if (
      q.type === "repeatable-group" &&
      q.config.questions.some((c) => c.id === field)
    ) {
      return q.id;
    }
  }
  return field;
}

/**
 * Write lab-form answers for an MCP client, all-or-nothing, through the
 * collaborative editor's buffer: staff with the workspace open see the values
 * live, and a field someone is editing right now is refused, not overwritten.
 * Only while the experiment is IN_PROGRESS. `null` clears a field; required
 * fields are left to finish, since a partial update can't satisfy them.
 */
export async function recordLabValues(
  editor: { userId: string; connectionId: string },
  ticketId: string,
  experimentId: string,
  values: Record<string, AnswerValue>,
): Promise<ActionResult<{ saved: string[] }>> {
  const room = collabRoomId(ticketId, experimentId);
  try {
    const ticket = await getTicket(undefined, ticketId);
    const status = ticket.experiments.find(
      (e) => e.id === experimentId,
    )?.status;
    if (status !== "IN_PROGRESS") {
      return {
        success: false,
        error: `Lab values can only be recorded while the experiment is IN_PROGRESS (it is ${status ?? "not on this ticket"}).`,
      };
    }
    await hydrate(room);
  } catch (error) {
    logHandledError(error, { op: "mcp.recordLabValues.load", contextId: room });
    return {
      success: false,
      error: "Could not load the experiment's lab form.",
    };
  }
  const template = await readTemplate(room);
  if (!template)
    return {
      success: false,
      error: "Could not load the experiment's lab form.",
    };
  const questions = template.labForm.questions;

  const [locks, presence] = await Promise.all([
    readLocks(room),
    readPresence(room),
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
    if (blocking.length > 0)
      problems.push(`${field}: ${blocking.map(describeAnswerIssue).join(" ")}`);
    const owner = locks[lockOwnerField(questions, field)];
    if (owner && owner !== editor.connectionId) {
      const who = names.get(owner) ?? "another staff member";
      problems.push(
        `${field}: ${who} is editing this field right now; try again shortly.`,
      );
    }
  }
  if (problems.length > 0) {
    return {
      success: false,
      error: `Nothing was saved.\n${problems.join("\n")}`,
    };
  }

  for (const [field, value] of Object.entries(values)) {
    await applyEdit(room, field, value, editor.userId);
    await publish(room, {
      type: "edit",
      field,
      value,
      by: editor.connectionId,
    });
  }
  try {
    if (!(await flushNow(room))) scheduleFlush(room);
  } catch (error) {
    // The buffer holds the values; the debounced flush retries the save.
    logHandledError(error, {
      op: "mcp.recordLabValues.flush",
      contextId: room,
    });
    scheduleFlush(room);
  }
  return { success: true, data: { saved: Object.keys(values) } };
}
