import type { AnswerValue } from "@repo/forms";

/**
 * Normalizes the answer columns of a dish group so every column has the same
 * length before the values reach experiment-manager.
 */

/** The dish group's shape, read off the raw (not Zod-parsed) wire snapshot. */
export interface DishGroupShape {
  groupId: string;
  /** Child question ids, each of which owns one column in `values`. */
  childIds: string[];
  /** The group's `config.count` — the hard cap on dishes. */
  count: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// The dish group declared by `labForm.dishRun`, or `null` if this is not a dish-run form. 
export function readDishGroup(labForm: unknown): DishGroupShape | null {
  const form = asRecord(labForm);
  const dishRun = asRecord(form?.dishRun);
  const groupId = dishRun?.group;
  if (typeof groupId !== "string" || !Array.isArray(form?.questions)) return null;

  for (const question of form.questions) {
    const q = asRecord(question);
    if (q?.id !== groupId || q.type !== "repeatable-group") continue;
    const config = asRecord(q.config);
    if (!config || !Array.isArray(config.questions)) return null;
    const { count } = config;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) return null;
    const childIds = config.questions
      .map((child) => asRecord(child)?.id)
      .filter((id): id is string => typeof id === "string");
    if (childIds.length === 0) return null;
    return { groupId, childIds, count };
  }
  return null;
}

/** Whether a cell counts as answered. `null`/`undefined` mean "not measured". */
function isAnswered(cell: unknown): boolean {
  return cell !== null && cell !== undefined;
}

export function activeDishCount(
  group: DishGroupShape,
  values: Record<string, AnswerValue>,
): number {
  let highest = -1;
  for (const childId of group.childIds) {
    const column = values[childId];
    if (!Array.isArray(column)) continue;
    const limit = Math.min(column.length, group.count);
    for (let index = limit - 1; index > highest; index -= 1) {
      if (isAnswered(column[index])) {
        highest = index;
        break;
      }
    }
  }
  return highest + 1;
}

export function touchedDishes(
  group: DishGroupShape,
  values: Record<string, AnswerValue>,
): boolean[] {
  const length = activeDishCount(group, values);
  return Array.from({ length }, (_, index) =>
    group.childIds.some((childId) => {
      const column = values[childId];
      return Array.isArray(column) && isAnswered(column[index]);
    }),
  );
}

/**
 * `values` with every column of the dish group rewritten to exactly
 * `activeDishCount` entries, padding with `null`.
 */
export function normalizeDishColumns(
  labForm: unknown,
  values: Record<string, AnswerValue>,
): Record<string, AnswerValue> {
  const group = readDishGroup(labForm);
  if (!group) return values;

  const length = activeDishCount(group, values);
  const next: Record<string, AnswerValue> = { ...values };
  for (const childId of group.childIds) {
    const column = values[childId];
    const existing = Array.isArray(column) ? column : [];
    next[childId] = Array.from({ length }, (_, index) =>
      isAnswered(existing[index]) ? existing[index] : null,
    ) as AnswerValue;
  }
  return next;
}
