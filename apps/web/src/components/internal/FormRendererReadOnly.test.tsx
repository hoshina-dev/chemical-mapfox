import type { FormDoc } from "@repo/forms";
import { FormRenderer } from "@repo/forms";
import { describe, expect, it } from "vitest";

import { render, screen } from "../../../test/render";

// A field that carries a configured default — the case where the read-only
// view used to fabricate a value the technician never sees.
const doc = {
  title: "Lab form",
  questions: [
    {
      id: "ph",
      type: "number",
      label: "pH",
      required: false,
      config: { default: 7 },
    },
  ],
} as FormDoc;

describe("FormRenderer read-only / fillDefaults", () => {
  it("pre-fills configured defaults by default (editable forms / previews)", () => {
    render(<FormRenderer doc={doc} initialValues={{}} readOnly />);
    expect(screen.getByLabelText("pH")).toHaveDisplayValue("7");
  });

  it("shows empty for unfilled fields when fillDefaults={false} (stored-state view)", () => {
    render(
      <FormRenderer doc={doc} initialValues={{}} readOnly fillDefaults={false} />,
    );
    // matches what the technician's collaborative editor shows for the same field
    expect(screen.getByLabelText("pH")).toHaveDisplayValue("");
  });

  it("still shows a stored value when one exists", () => {
    render(
      <FormRenderer
        doc={doc}
        initialValues={{ ph: 5 }}
        readOnly
        fillDefaults={false}
      />,
    );
    expect(screen.getByLabelText("pH")).toHaveDisplayValue("5");
  });
});
