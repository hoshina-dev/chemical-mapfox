import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, within } from "../../test/render";
import { UserMenu } from "./UserMenu";

vi.mock("@/app/actions/auth", () => ({
  logout: vi.fn(),
}));

const portalBase = "https://portal.example.com";

const baseProps = {
  name: "Alice Smith",
  email: "alice@example.com",
  role: "admin" as const,
  organizationPortalUrl: portalBase,
};

describe("UserMenu", () => {
  it("shows an empty organizations message when the user has none", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...baseProps} organizations={[]} />);

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(await screen.findByText("No organizations yet.")).toBeInTheDocument();
  });

  it("links a single organization to the portal and shows its role beside the section label", async () => {
    const user = userEvent.setup();
    render(
      <UserMenu
        {...baseProps}
        organizations={[
          { id: "org-1", name: "Chulalongkorn University", role: "MANAGER" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "User menu" }));

    const link = await screen.findByRole("link", { name: "Chulalongkorn University" });
    expect(link).toHaveAttribute(
      "href",
      "https://portal.example.com/organization/org-1",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const header = screen.getByText("Organizations").closest("div");
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText("MANAGER")).toBeInTheDocument();
  });

  it("shows per-organization role chips when the user belongs to multiple orgs", async () => {
    const user = userEvent.setup();
    render(
      <UserMenu
        {...baseProps}
        organizations={[
          { id: "org-1", name: "Org Alpha", role: "MANAGER" },
          { id: "org-2", name: "Org Beta", role: "MEMBER" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(await screen.findByRole("link", { name: "Org Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Org Beta" })).toBeInTheDocument();
    expect(screen.getByText("MANAGER")).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();

    const header = screen.getByText("Organizations").closest("div");
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).queryByText("MANAGER")).not.toBeInTheDocument();
  });

  it("calls logout when Log out is clicked", async () => {
    const { logout } = await import("@/app/actions/auth");
    const user = userEvent.setup();
    render(<UserMenu {...baseProps} organizations={[]} />);

    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("renders the dark trigger variant for client users", () => {
    render(
      <UserMenu
        {...baseProps}
        name="Casey Client"
        email={undefined}
        role="user"
        variant="dark"
        organizations={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
  });

  it("renders the light trigger variant for client users", () => {
    render(
      <UserMenu
        {...baseProps}
        name="Casey Client"
        role="user"
        organizations={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
  });

  it("renders the dark trigger variant for staff users", () => {
    render(
      <UserMenu
        {...baseProps}
        role="admin"
        variant="dark"
        organizations={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("Lab Staff")).toBeInTheDocument();
  });
});
