import "server-only";

const DEFAULT_URL = "http://sample-tracker.mapfox.hoshina.san/api/v1";

/** sample_tracker's API base, `/api/v1` included. */
export function getSampleTrackerUrl(): string {
  return process.env.SAMPLE_TRACKER_URL?.replace(/\/$/, "") ?? DEFAULT_URL;
}
