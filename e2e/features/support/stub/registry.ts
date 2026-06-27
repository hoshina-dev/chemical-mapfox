import type { StubContext, StubModule } from "./types.js";

const modules: StubModule[] = [];

/** Register a stub module. Call this at module top-level inside `stub/modules/*`. */
export function registerStub(module: StubModule): void {
  if (modules.some((m) => m.name === module.name)) {
    throw new Error(`duplicate stub module "${module.name}"`);
  }
  modules.push(module);
}

/** Reset every registered module's local state (called per scenario). */
export function resetStubs(): void {
  for (const m of modules) m.reset?.();
}

/** Dispatch a request to the first module that handles it. */
export async function dispatch(ctx: StubContext): Promise<boolean> {
  for (const m of modules) {
    if (await m.handle(ctx)) return true;
  }
  return false;
}

export function registeredStubNames(): string[] {
  return modules.map((m) => m.name);
}
