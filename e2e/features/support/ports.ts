import net from "node:net";

/**
 * Ask the OS for a free TCP port. Used so parallel test runs (e.g. one per
 * feature, in separate git worktrees) never collide on a fixed port.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}
