import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../../test/render";
import { SignOutEverywhere } from "./SignOutEverywhere";

vi.mock("@/app/actions/account", () => ({
  signOutEverywhere: vi.fn(),
}));

describe("SignOutEverywhere", () => {
  it("signs out every session when the button is clicked", async () => {
    const { signOutEverywhere } = await import("@/app/actions/account");
    const user = userEvent.setup();
    render(<SignOutEverywhere />);

    expect(screen.getByRole("heading", { name: "Sessions" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Sign out on all devices" }),
    );

    expect(signOutEverywhere).toHaveBeenCalledOnce();
  });
});
