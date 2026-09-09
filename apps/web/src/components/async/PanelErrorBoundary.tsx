"use client";

import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { Component, type ReactNode } from "react";

interface PanelErrorBoundaryProps {
  children: ReactNode;
  /** Shown above the retry control. Supplied by the server so it is localised. */
  title: string;
  body: string;
  retryLabel: string;
}

interface PanelErrorBoundaryState {
  /** Bumped on retry to remount children, discarding the failed subtree. */
  key: number;
  failed: boolean;
  error: unknown;
}

/**
 * Next signals control flow by throwing: `notFound()` and `redirect()` raise
 * errors carrying a `NEXT_*` digest that the framework is meant to catch.
 * A boundary that swallows them turns "not found" into "could not load", and —
 * because `requireSession()` redirects the same way — turns "log in again"
 * into a dead panel. These must always be re-thrown.
 */
function isFrameworkSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_")
  );
}

/**
 * Catches a throw from one panel so the rest of the page keeps rendering.
 *
 * Next's `error.tsx` replaces the whole route, which is the wrong granularity
 * here: a stalled backend should cost you that panel, not the page you are
 * standing on. React error boundaries must be class components and must run on
 * the client, so this is the one "use client" file in the pattern — the panels
 * it wraps stay server components.
 *
 * Retry remounts the subtree rather than reloading the route, so an unrelated
 * panel that already rendered is not thrown away.
 */
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { key: 0, failed: false, error: null };

  static getDerivedStateFromError(
    error: unknown,
  ): Partial<PanelErrorBoundaryState> {
    return { failed: true, error };
  }

  private retry = () => {
    this.setState((s) => ({ key: s.key + 1, failed: false, error: null }));
  };

  render() {
    if (this.state.failed) {
      // Re-thrown from render so it propagates to the framework's own
      // boundary, which is the only thing that can serve a 404 or a redirect.
      if (isFrameworkSignal(this.state.error)) {
        throw this.state.error;
      }
      return (
        <Alert color="yellow" variant="light" title={this.props.title}>
          <Stack gap="sm">
            <Text size="sm">{this.props.body}</Text>
            <Group>
              <Button size="xs" variant="default" onClick={this.retry}>
                {this.props.retryLabel}
              </Button>
            </Group>
          </Stack>
        </Alert>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
