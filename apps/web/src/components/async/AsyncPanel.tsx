import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { PanelSkeleton } from "./PanelSkeleton";

interface AsyncPanelProps {
  /** An async server component that awaits its own data. */
  children: ReactNode;
  /** Placeholder while the data streams. Defaults to a generic skeleton. */
  fallback?: ReactNode;
}

/**
 * Wraps one region of a page so that neither a slow backend nor a failing one
 * can hold up the page around it.
 *
 * A page must not `await` its data directly: Next emits a route's HTML only
 * once the component function returns, so a single unresolved fetch withholds
 * the entire page — nav, header and chrome included — and the browser shows
 * nothing at all. Moving the await into a child under `Suspense` lets the
 * shell flush immediately and the panel arrive on its own schedule.
 *
 * Pair with the downstream deadline in `lib/log/downstream.ts`: the deadline
 * guarantees the await *ends*, this guarantees the wait is *contained*.
 */
export async function AsyncPanel({ children, fallback }: AsyncPanelProps) {
  const t = await getTranslations("common.asyncPanel");

  return (
    <PanelErrorBoundary
      title={t("title")}
      body={t("body")}
      retryLabel={t("retry")}
    >
      <Suspense fallback={fallback ?? <PanelSkeleton />}>{children}</Suspense>
    </PanelErrorBoundary>
  );
}
