import { describe, expect, it } from "vitest";

import { sandboxDocument } from "./sandboxSource";

const index = "https://lab.example/pyodide/0.27.7/";

function csp(doc: string): Map<string, string> {
  const content = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(doc)?.[1] ?? "";
  return new Map(
    content.split(";").map((part) => {
      const [name = "", ...sources] = part.trim().split(/\s+/);
      return [name, sources.join(" ")];
    }),
  );
}

describe("sandboxDocument", () => {
  const doc = sandboxDocument(index);

  it("lets the frame reach the runtime and nothing else", () => {
    const policy = csp(doc);
    expect(policy.get("default-src")).toBe("'none'");
    expect(policy.get("connect-src")).toBe(index);
    expect(policy.get("worker-src")).toBe("blob:");
    expect(policy.get("script-src")).toBe(`'unsafe-inline' 'wasm-unsafe-eval' blob: ${index}`);
  });

  it("only takes commands from its parent and binds replies to the job", () => {
    expect(doc).toContain("event.source !== parent");
    expect(doc).toContain("if (job !== current) return;");
    expect(doc).toContain("current.worker.terminate()");
  });

  it("keeps the embedded engine from closing the script element", () => {
    expect(doc.match(/<\/script>/g)).toHaveLength(1);
    expect(doc.endsWith("</script>")).toBe(true);
  });
});
