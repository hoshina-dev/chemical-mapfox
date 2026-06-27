import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { PresenceEntry } from "@/lib/collab/events";

import { render, screen } from "../../../../test/render";
import { PresenceBar } from "./PresenceBar";

const editors: PresenceEntry[] = [
  { connectionId: "ca", userId: "a", name: "Alice Smith", avatarUrl: null, color: "grape" },
  { connectionId: "cb", userId: "b", name: "Bob Jones", avatarUrl: null, color: "cyan" },
];

describe("PresenceBar", () => {
  it("shows an empty-state message when no one else is editing", () => {
    render(<PresenceBar editors={[]} />);
    expect(screen.getByText(/No one else is editing/i)).toBeInTheDocument();
  });

  it("renders an avatar (with initials) for each active editor", () => {
    render(<PresenceBar editors={editors} />);
    expect(screen.getByText("Editing now:")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.getByText("BJ")).toBeInTheDocument();
  });

  it("reveals the full name on hover", async () => {
    const user = userEvent.setup();
    render(<PresenceBar editors={editors} />);
    await user.hover(screen.getByText("AS"));
    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
  });
});
