import type { SandboxCommand, SandboxReply } from "./protocol";
import { sandboxDocument } from "./sandboxSource";

export interface Sandbox {
  post(command: SandboxCommand): void;
  onReply(listener: (reply: SandboxReply) => void): () => void;
  dispose(): void;
}

/**
 * Hidden `sandbox="allow-scripts"` frame that runs the engine (see
 * sandboxSource.ts). Formulas are untrusted code, so they never run with this
 * page's origin.
 */
export function createSandbox(): Sandbox {
  const indexUrl = `${location.origin}/pyodide/${process.env.NEXT_PUBLIC_PYODIDE_VERSION}/`;
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.display = "none";
  frame.srcdoc = sandboxDocument(indexUrl);

  const listeners = new Set<(reply: SandboxReply) => void>();
  let pending: SandboxCommand[] | null = [];

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return;
    const reply = event.data as SandboxReply;
    if (reply?.type === "booted") {
      for (const command of pending ?? []) frame.contentWindow?.postMessage(command, "*");
      pending = null;
      return;
    }
    for (const listener of listeners) listener(reply);
  };
  window.addEventListener("message", onMessage);
  document.body.append(frame);

  return {
    post(command) {
      if (pending) pending.push(command);
      else frame.contentWindow?.postMessage(command, "*");
    },
    onReply(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      window.removeEventListener("message", onMessage);
      listeners.clear();
      frame.remove();
    },
  };
}
