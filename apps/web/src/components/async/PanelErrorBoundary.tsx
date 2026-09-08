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
  state: PanelErrorBoundaryState = { key: 0, failed: false };

  static getDerivedStateFromError(): Partial<PanelErrorBoundaryState> {
    return { failed: true };
  }

  private retry = () => {
    this.setState((s) => ({ key: s.key + 1, failed: false }));
  };

  render() {
    if (this.state.failed) {
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
