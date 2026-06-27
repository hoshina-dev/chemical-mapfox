/**
 * Resolved, per-run configuration (ports + base URL), filled in once during the
 * BeforeAll hook after free ports are picked. Read by the world and the
 * web-server launcher. Kept separate from `config.ts` (static env-derived
 * settings) so the dynamic values have a single source of truth.
 */
interface ResolvedRuntime {
  webPort: number;
  stubPort: number;
  baseUrl: string;
}

let resolved: ResolvedRuntime | null = null;

export function setRuntime(value: ResolvedRuntime): void {
  resolved = value;
}

function require_(): ResolvedRuntime {
  if (!resolved) {
    throw new Error("runtime not initialised — BeforeAll has not run yet");
  }
  return resolved;
}

export const runtime = {
  get webPort(): number {
    return require_().webPort;
  },
  get stubPort(): number {
    return require_().stubPort;
  },
  get baseUrl(): string {
    return require_().baseUrl;
  },
};
