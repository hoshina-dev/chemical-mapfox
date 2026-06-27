import { userEvent } from "@testing-library/user-event";
import type { FormDoc } from "@repo/forms";
import { describe, expect, it, vi } from "vitest";

import type { PresenceEntry } from "@/lib/collab/events";

import { render, screen } from "../../../../test/render";
import { CollaborativeFormRenderer } from "./CollaborativeFormRenderer";

const doc: FormDoc = {
  name: "Lab form",
  questions: [
    { id: "ph", type: "number", label: "pH", required: false },
    { id: "note", type: "string", label: "Note", required: false },
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
    expect(screen.getByLabelText("pH")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveDisplayValue("hi");
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
});
