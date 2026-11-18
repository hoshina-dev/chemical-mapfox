import { type FormDoc, FormRenderer, localDateString } from "@repo/forms";
import { describe, expect, it } from "vitest";

import { render, screen } from "../../../test/render";

const doc = {
  name: "Lab form",
  questions: [
    { id: "received", type: "date", label: "Received", config: { default: "today" } },
    { id: "fixed", type: "date", label: "Fixed", config: { default: "2025-01-02" } },
    { id: "blank", type: "date", label: "Blank" },
  ],
} as FormDoc;

describe("date question defaulting to today", () => {
  it("fills today's date, keeps a fixed default, and leaves an unset one empty", () => {
    render(<FormRenderer doc={doc} />);
    expect(screen.getByLabelText("Received")).toHaveDisplayValue(localDateString());
    expect(screen.getByLabelText("Fixed")).toHaveDisplayValue("2025-01-02");
    expect(screen.getByLabelText("Blank")).toHaveDisplayValue("");
  });

  it("submits the resolved date, not the sentinel", async () => {
    let submitted: unknown;
    render(<FormRenderer doc={doc} onSubmit={(a) => (submitted = a)} submitLabel="Send" />);
    screen.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => submitted).toMatchObject({ received: localDateString() });
  });
});
