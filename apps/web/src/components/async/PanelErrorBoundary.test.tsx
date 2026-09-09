import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../../test/render";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

/**
 * The boundary exists to contain a failed panel, but Next signals control flow
 * by throwing too: `notFound()` and `redirect()` raise errors carrying a
 * `NEXT_*` digest. Swallowing those turns "not found" into "could not load",
 * and — since `requireSession()` redirects the same way — turns "log in again"
 * into a dead panel with no way out.
 */
function Boom({ error }: { error: unknown }): never {
  throw error;
}

function nextError(digest: string): Error {
  return Object.assign(new Error(digest), { digest });
}

const labels = {
  title: "Could not load",
  body: "The service did not respond.",
  retryLabel: "Retry",
};

describe("PanelErrorBoundary", () => {
  it("renders its fallback for an ordinary failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PanelErrorBoundary {...labels}>
        <Boom error={new Error("downstream exploded")} />
      </PanelErrorBoundary>,
    );

    expect(screen.getByText(labels.title)).toBeTruthy();
  });

  it.each([
    ["notFound()", "NEXT_HTTP_ERROR_FALLBACK;404"],
    ["redirect()", "NEXT_REDIRECT;replace;/login;307;"],
  ])("re-throws the %s signal instead of swallowing it", (_label, digest) => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <PanelErrorBoundary {...labels}>
          <Boom error={nextError(digest)} />
        </PanelErrorBoundary>,
      ),
    ).toThrow();
  });
});
