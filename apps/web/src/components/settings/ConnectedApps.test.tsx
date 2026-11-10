import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "../../../test/render";
import { ConnectedApps } from "./ConnectedApps";

vi.mock("@/app/actions/oauth", () => ({
  revokeConnectedAppAction: vi.fn(),
}));

const claude = {
  grantId: "grant-claude",
  clientName: "Claude",
  redirectHost: "claude.ai",
  scope: "staff",
  createdAt: Date.UTC(2024, 0, 15, 10, 30),
  lastUsedAt: Date.UTC(2024, 0, 16, 11, 0),
};

const chatgpt = {
  grantId: "grant-gpt",
  clientName: "ChatGPT",
  redirectHost: "chatgpt.com",
  scope: "experiments:read templates:write",
  createdAt: Date.UTC(2024, 2, 1, 8, 0),
  lastUsedAt: Date.UTC(2024, 2, 2, 9, 0),
};

function paragraphMatching(pattern: RegExp) {
  return (_: string, node: Element | null) =>
    node?.tagName === "P" && pattern.test(node.textContent ?? "");
}

describe("ConnectedApps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows what each app may do", () => {
    render(<ConnectedApps apps={[claude, chatgpt]} />);

    const [full, narrow] = screen.getAllByLabelText("Access");
    expect(full).toHaveTextContent(/View.*Run experiments.*Onboard methods/);
    expect(narrow).toHaveTextContent(/View.*Onboard methods/);
    expect(narrow).not.toHaveTextContent("Run experiments");
  });

  it("renders the empty state when there are no apps", () => {
    render(<ConnectedApps apps={[]} />);

    expect(
      screen.getByRole("heading", { name: "Connected apps" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "No connected apps. When you allow Claude or ChatGPT to connect, they'll appear here.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Disconnect" }),
    ).not.toBeInTheDocument();
  });

  it("lists each connected app with host and timestamps", () => {
    render(<ConnectedApps apps={[claude, chatgpt]} />);

    expect(screen.getByText("Claude")).toBeVisible();
    expect(screen.getByText("claude.ai")).toBeVisible();
    expect(screen.getByText("ChatGPT")).toBeVisible();
    expect(screen.getByText("chatgpt.com")).toBeVisible();
    expect(
      screen.getByText(paragraphMatching(/Connected 2024-01-15/)),
    ).toBeVisible();
    expect(
      screen.getByText(paragraphMatching(/Last used 2024-01-16/)),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Disconnect" })).toHaveLength(
      2,
    );
  });

  it("disconnects an app after confirm", async () => {
    const { revokeConnectedAppAction } = await import("@/app/actions/oauth");
    const user = userEvent.setup();
    render(<ConnectedApps apps={[claude, chatgpt]} />);

    await user.click(screen.getAllByRole("button", { name: "Disconnect" })[0]!);
    expect(
      screen.getByText(
        "Disconnect Claude? It will no longer be able to act as you.",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(revokeConnectedAppAction).toHaveBeenCalledWith("grant-claude");
  });

  it("does not disconnect when confirm is cancelled", async () => {
    const { revokeConnectedAppAction } = await import("@/app/actions/oauth");
    const user = userEvent.setup();
    render(<ConnectedApps apps={[claude]} />);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(revokeConnectedAppAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeVisible();
    expect(
      screen.queryByText(
        "Disconnect Claude? It will no longer be able to act as you.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows a loading state on the row being disconnected", async () => {
    const { revokeConnectedAppAction } = await import("@/app/actions/oauth");
    const { promise, resolve } = Promise.withResolvers<void>();
    vi.mocked(revokeConnectedAppAction).mockReturnValue(promise);
    const user = userEvent.setup();
    render(<ConnectedApps apps={[claude, chatgpt]} />);

    await user.click(screen.getAllByRole("button", { name: "Disconnect" })[0]!);
    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
        "data-loading",
        "true",
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
    });

    resolve();
    await waitFor(() => {
      expect(revokeConnectedAppAction).toHaveBeenCalledWith("grant-claude");
    });
  });
});
