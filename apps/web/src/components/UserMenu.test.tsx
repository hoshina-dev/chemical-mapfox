import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test/render";
import { UserMenu } from "./UserMenu";

vi.mock("@/app/actions/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("@/app/actions/locale", () => ({
  setLocaleAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseProps = {
  name: "Alice Smith",
  email: "alice@example.com",
  role: "admin" as const,
};

describe("UserMenu", () => {
  it("links to notification settings when settingsHref is provided", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...baseProps} settingsHref="/experiment/settings" />);

    await user.click(screen.getByRole("button", { name: "User menu" }));

    const link = await screen.findByRole("menuitem", {
      name: "Notification settings",
    });
    expect(link).toHaveAttribute("href", "/experiment/settings");
  });

  it("calls logout when Log out is clicked", async () => {
    const { logout } = await import("@/app/actions/auth");
    const user = userEvent.setup();
    render(<UserMenu {...baseProps} />);

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
      />,
    );
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
  });

  it("renders the light trigger variant for client users", () => {
    render(<UserMenu {...baseProps} name="Casey Client" role="user" />);
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
  });

  it("renders the dark trigger variant for staff users", () => {
    render(<UserMenu {...baseProps} role="admin" variant="dark" />);
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("Lab Staff")).toBeInTheDocument();
  });
});
