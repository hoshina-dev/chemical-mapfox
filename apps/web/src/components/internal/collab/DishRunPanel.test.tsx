import { describe, expect, it } from "vitest";

import { evaluateDishRun, type ResolvedRule } from "@/lib/forms/dishRun";

import { render, screen } from "../../../../test/render";
import { DishRunPanel } from "./DishRunPanel";

function rule(series: unknown, limit = 0.3, extra: Partial<ResolvedRule> = {}): ResolvedRule {
  return { target: "G", label: "G (%)", limit, result: series, ...extra };
}

/** Built from the real evaluator, so the panel is tested against real states. */
function state(series: unknown[], limit = 0.3) {
  return evaluateDishRun({
    rules: [rule(series, limit)],
    activeDishCount: series.length,
    maxDishes: 8,
  });
}

describe("DishRunPanel", () => {
  it("renders nothing for a method that is not a dish run", () => {
    render(
      <DishRunPanel
        state={evaluateDishRun({ rules: [], activeDishCount: 0, maxDishes: 8 })}
      />,
    );
    // The provider still injects its <style> tags, so assert on content: no
    // banner, no comparison table, nothing about dishes at all.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/dish/i)).not.toBeInTheDocument();
  });

  it("asks for the next dish while fewer than two are measured", () => {
    render(<DishRunPanel state={state([8.42])} />);
    expect(screen.getByText("Measure dish 2")).toBeInTheDocument();
  });

  it("names the accepted pair when a pair agrees", () => {
    render(<DishRunPanel state={state([8.42, 8.55])} />);
    expect(
      screen.getByText("Dishes 1 and 2 agree — this sample is ready to submit"),
    ).toBeInTheDocument();
  });

  // The figure shown is the engine's own `final_*` calculation, so the panel and
  // the PDF certificate cannot disagree.
  it("shows the engine's reported value against the accepted pair", () => {
    const base = state([8.42, 8.55]);
    render(
      <DishRunPanel
        state={{
          ...base,
          reported: [
            { target: "G", label: "G (%)", calculation: "final_G", value: 8.49 },
          ],
        }}
      />,
    );
    expect(screen.getByText("Final result, from dishes 1 and 2")).toBeInTheDocument();
    expect(screen.getByText("G (%)")).toBeInTheDocument();
    expect(screen.getByText("8.49")).toBeInTheDocument();
  });

  it("says the result is pending while no pair agrees", () => {
    const base = state([8.42, 8.9]);
    render(
      <DishRunPanel
        state={{
          ...base,
          reported: [
            { target: "G", label: "G (%)", calculation: "final_G", value: null },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("Reported result (no pair agrees yet)"),
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the difference against the limit for each compared pair", () => {
    render(<DishRunPanel state={state([8.42, 8.9])} />);
    expect(
      screen.getByText("The dishes measured so far don’t agree — measure dish 3"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 and 2")).toBeInTheDocument();
    // |8.42 - 8.9| against the 0.3 limit.
    expect(screen.getByText(/0\.48.*limit 0\.3/)).toBeInTheDocument();
  });

  // The first qualifying pair wins, and the dish left out is flagged but not
  // treated as a problem.
  it("marks the winning pair and reports an unused dish", () => {
    render(<DishRunPanel state={state([8.42, 8.9, 8.6])} />);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("1 and 3")).toBeInTheDocument();
    expect(
      screen.getByText("Dish 2 was measured but is not part of the accepted pair."),
    ).toBeInTheDocument();
  });

  it("reports that no pair agrees once every allowed dish is measured", () => {
    render(<DishRunPanel state={state([1, 2, 3, 4, 5, 6, 7, 8], 0.1)} />);
    expect(screen.getByText("No two dishes agree after 8 dishes")).toBeInTheDocument();
  });

  it("explains a template problem rather than showing a decision", () => {
    render(
      <DishRunPanel
        state={evaluateDishRun({
          rules: [rule([1, 2, 3, 4])],
          activeDishCount: 2,
          maxDishes: 8,
        })}
      />,
    );
    expect(
      screen.getByText("This method’s dish setup can’t be evaluated"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("“G” produced 4 values for 2 dishes."),
    ).toBeInTheDocument();
  });

  it("shows a pair touching an unmeasured dish as not yet comparable", () => {
    render(<DishRunPanel state={state([8.42, null, 8.5])} />);
    expect(screen.getAllByText("Not measured yet").length).toBeGreaterThan(0);
  });
});
