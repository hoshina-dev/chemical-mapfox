import { userEvent } from "@testing-library/user-event";
import type { FormDoc } from "@repo/forms";
import { describe, expect, it, vi } from "vitest";

import type { PresenceEntry } from "@/lib/collab/events";

import { render, screen, within } from "../../../../test/render";
import { CollaborativeFormRenderer } from "./CollaborativeFormRenderer";

const doc: FormDoc = {
  name: "Lab form",
  description: "Collaborative lab entry",
  questions: [
    { id: "ph", type: "number", label: "pH", required: false },
    { id: "note", type: "string", label: "Note", required: false },
    {
      id: "measurements",
      type: "repeatable-group",
      label: "Measurements",
      required: true,
      config: {
        count: 2,
        questions: [
          {
            id: "reading",
            type: "number",
            label: "Reading",
            required: true,
          },
        ],
      },
    },
  ],
};

const alice: PresenceEntry = {
  connectionId: "conn-alice",
  userId: "alice",
  name: "Alice Smith",
  avatarUrl: null,
  color: "grape",
};

const noop = {
  onFocusField: () => {},
  onBlurField: () => {},
  onEdit: () => {},
};

const MINE = "conn-me";

describe("CollaborativeFormRenderer", () => {
  it("renders a field for each question", () => {
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{ ph: 7, note: "hi" }}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
      />,
    );
    expect(screen.getByText("Lab form")).toBeInTheDocument();
    expect(screen.getByText("Collaborative lab entry")).toBeInTheDocument();
    expect(screen.getByLabelText("pH")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveDisplayValue("hi");
  });

  it("prevents native form submission", () => {
    const { container } = render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{}}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
      />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("reports focus on a field", async () => {
    const user = userEvent.setup();
    const onFocusField = vi.fn();
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{}}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
        onFocusField={onFocusField}
      />,
    );
    await user.click(screen.getByLabelText("Note"));
    expect(onFocusField).toHaveBeenCalledWith("note");
  });

  it("reports blur on a field", async () => {
    const user = userEvent.setup();
    const onBlurField = vi.fn();
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{}}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
        onBlurField={onBlurField}
      />,
    );
    const note = screen.getByLabelText("Note");
    await user.click(note);
    await user.tab();
    expect(onBlurField).toHaveBeenCalledWith("note");
  });

  it("makes a field locked by another connection non-interactive while keeping its value", () => {
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{ ph: 7 }}
        locks={{ ph: alice.connectionId }}
        editorsByConnection={new Map([[alice.connectionId, alice]])}
        currentConnectionId={MINE}
        {...noop}
      />,
    );
    const input = screen.getByLabelText("pH");
    // disabled (non-interactive) but its value is still present + legible
    // (full-contrast via the shared `readable` style, asserted visually).
    expect(input).toBeDisabled();
    expect(input).toHaveDisplayValue("7");
    // owner's avatar initials are shown next to the locked field
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("ignores a lock whose owner is no longer present (no stuck lock)", () => {
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{ ph: 7 }}
        locks={{ ph: "ghost-connection" }} // owner not in presence
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
      />,
    );
    // not shown as locked — editable, no owner avatar
    expect(screen.getByLabelText("pH")).toBeEnabled();
    expect(screen.queryByText("AL")).toBeNull();
  });

  it("updates a locked field's displayed value live as remote edits arrive", () => {
    const props = {
      doc,
      locks: { ph: alice.connectionId },
      editorsByConnection: new Map([[alice.connectionId, alice]]),
      currentConnectionId: MINE,
      ...noop,
    };
    const { rerender } = render(
      <CollaborativeFormRenderer {...props} values={{ ph: 7 }} />,
    );
    expect(screen.getByLabelText("pH")).toHaveDisplayValue("7");

    // simulate a remote `edit` arriving (parent pushes new values)
    rerender(<CollaborativeFormRenderer {...props} values={{ ph: 9 }} />);
    expect(screen.getByLabelText("pH")).toHaveDisplayValue("9");
  });

  it("reports local edits via onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{ note: "" }}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
        onEdit={onEdit}
      />,
    );
    await user.type(screen.getByLabelText("Note"), "x");
    expect(onEdit).toHaveBeenCalledWith("note", "x");
  });

  it("reports repeatable-group edits via onEdit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{ reading: [1, 2] }}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
        onEdit={onEdit}
      />,
    );
    const firstItem = screen.getByRole("tabpanel", { name: "Item 1" });
    const input = within(firstItem).getByRole("textbox", { name: /Reading/ });
    await user.clear(input);
    await user.type(input, "5");
    expect(onEdit).toHaveBeenCalledWith("reading", [5, 2]);
  });

  it("initializes repeatable-group columns when no prior values exist", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{}}
        locks={{}}
        editorsByConnection={new Map()}
        currentConnectionId={MINE}
        {...noop}
        onEdit={onEdit}
      />,
    );
    const firstItem = screen.getByRole("tabpanel", { name: "Item 1" });
    const input = within(firstItem).getByRole("textbox", { name: /Reading/ });
    await user.type(input, "3");
    expect(onEdit).toHaveBeenCalledWith("reading", [3]);
  });

  it("locks a field without a highlight tint when the editor color is missing", () => {
    const editorWithoutColor = { ...alice, color: undefined } as unknown as PresenceEntry;
    render(
      <CollaborativeFormRenderer
        doc={doc}
        values={{ ph: 7 }}
        locks={{ ph: alice.connectionId }}
        editorsByConnection={new Map([[alice.connectionId, editorWithoutColor]])}
        currentConnectionId={MINE}
        {...noop}
      />,
    );
    expect(screen.getByLabelText("pH")).toBeDisabled();
    expect(screen.queryByText("AS")).toBeInTheDocument();
  });
});
