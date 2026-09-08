import { PanelSkeleton } from "@/components/async/PanelSkeleton";

/**
 * Shown the moment a link into any route without its own loading.tsx is clicked. Without this Next holds
 * the old page on screen until the next route's shell is ready, which reads as
 * a frozen UI when a backend is slow. The layout (nav, chrome) stays mounted;
 * only the page area is replaced.
 */
export default function RootLoading() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <PanelSkeleton lines={6} />
    </div>
  );
}
