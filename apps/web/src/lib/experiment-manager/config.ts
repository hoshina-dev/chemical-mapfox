import "server-only";

const DEFAULT_URL = "http://experiment-manager.mapfox.hoshina.san/api/v1";

/** experiment-manager's API base, `/api/v1` included. */
export function getExperimentManagerUrl(): string {
  return process.env.EXPERIMENT_MANAGER_URL?.replace(/\/$/, "") ?? DEFAULT_URL;
}
