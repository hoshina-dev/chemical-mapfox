import type { DishRunIssue, DishRunState } from "./dishRun";

export type DishRunTranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

/** How many dish tabs to show. */
export function visibleDishCount(state: DishRunState, maxDishes: number): number {
  const wanted = Math.max(2, state.nextDish ?? state.activeDishCount);
  return Math.min(wanted, maxDishes);
}

/**
 * The panel's headline: what the technician should do next.
 */
export function dishRunHeadline(t: DishRunTranslateFn, state: DishRunState): string {
  switch (state.phase) {
    case "DONE":
      return t("headline.done", {
        a: state.acceptedPair?.[0] ?? 0,
        b: state.acceptedPair?.[1] ?? 0,
      });
    case "AWAITING_DISHES":
      return t("headline.awaitingDishes", { next: state.nextDish ?? 1 });
    case "AWAITING_NEXT_DISH":
      return t("headline.awaitingNextDish", { next: state.nextDish ?? 0 });
    case "NEEDS_REVIEW":
      return t("headline.needsReview", { max: state.activeDishCount });
    default:
      return t("headline.configError");
  }
}

/** Mantine alert colour matching the phase's severity. */
export function dishRunTone(state: DishRunState): "teal" | "yellow" | "red" | "gray" {
  switch (state.phase) {
    case "DONE":
      return "teal";
    case "AWAITING_DISHES":
    case "AWAITING_NEXT_DISH":
      return "yellow";
    case "NEEDS_REVIEW":
    case "CONFIG_ERROR":
      return "red";
    default:
      return "gray";
  }
}

/** One config problem, in the reader's language. */
export function describeDishRunIssue(
  t: DishRunTranslateFn,
  issue: DishRunIssue,
): string {
  return t(`issue.${issue.code}`, {
    target: issue.target ?? "",
    expected: issue.expected ?? "",
    actual: issue.actual ?? "",
    detail: issue.detail ?? "",
  });
}
