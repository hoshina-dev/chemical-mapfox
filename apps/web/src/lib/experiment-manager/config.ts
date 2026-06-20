import "server-only";

const DEFAULT_URL = "http://experiment-manager.mapfox.hoshina.san";

export function getExperimentManagerUrl(): string {
  return process.env.EXPERIMENT_MANAGER_URL?.replace(/\/$/, "") ?? DEFAULT_URL;
}
