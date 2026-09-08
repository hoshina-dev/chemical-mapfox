import { Skeleton, Stack } from "@mantine/core";

interface PanelSkeletonProps {
  /** Placeholder lines to draw. Roughly match the real panel's height so the
   *  shell does not jump when the data arrives. */
  lines?: number;
}

/**
 * Default placeholder shown while a panel's data is still streaming. Panels
 * with a distinctive shape (a table, a form) should pass their own fallback to
 * `AsyncPanel` instead.
 */
export function PanelSkeleton({ lines = 3 }: PanelSkeletonProps) {
  return (
    <Stack gap="sm" aria-busy="true" data-testid="panel-skeleton">
      <Skeleton height={20} width="40%" radius="sm" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} radius="sm" />
      ))}
    </Stack>
  );
}
