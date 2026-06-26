import http from "node:http";

import {
  createUserFromRegistration,
  db,
  findOrgById,
  findUserByEmail,
  findUserById,
  membershipWire,
  orgWire,
  userDetailWire,
  userWire,
} from "./fixtures.js";

/**
 * A single HTTP server that stands in for all three backends the BFF talks to
 * server-side: custapi (users/orgs), ticketing-service, and experiment-manager.
 * The app is configured (via env) to point CUSTAPI_URL / TICKETING_URL /
 * EXPERIMENT_MANAGER_URL at this one server. Paths don't collide:
 *   - custapi:  /api/v1/users/**, /api/v1/organizations/**
 *   - ticketing: /api/v1/tickets/**
 * Anything unmatched returns a benign empty body so post-login landing pages
 * (which best-effort fetch listings) render cleanly.
 */

let server: http.Server | null = null;

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const segments = url.pathname.split("/").filter(Boolean); // drop empty
  // Strip the /api/v1 prefix shared by custapi + ticketing.
  const [p0, p1, ...rest] = segments;
  const path = p0 === "api" && p1 === "v1" ? rest : segments;

  // ---- custapi: users ----------------------------------------------------
  if (path[0] === "users") {
    // GET /users/email/{email}
    if (method === "GET" && path[1] === "email" && path[2]) {
      const user = findUserByEmail(decodeURIComponent(path[2]));
      if (!user) return send(res, 404, { error: "user not found" });
      return send(res, 200, userDetailWire(user));
    }
    // GET /users/id/{id}/organizations
    if (method === "GET" && path[1] === "id" && path[2] && path[3] === "organizations") {
      const user = findUserById(decodeURIComponent(path[2]));
      const orgs = (user?.organizationIds ?? [])
        .map((id) => findOrgById(id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));
      return send(res, 200, orgs.map(membershipWire));
    }
    // GET /users/id/{id}
    if (method === "GET" && path[1] === "id" && path[2]) {
      const user = findUserById(decodeURIComponent(path[2]));
      if (!user) return send(res, 404, { error: "user not found" });
      return send(res, 200, userDetailWire(user));
    }
    // GET /users
    if (method === "GET" && path.length === 1) {
      return send(res, 200, db.users.map(userWire));
    }
    // POST /users  (registration)
    if (method === "POST" && path.length === 1) {
      const body = (await readBody(req)) as {
        email?: string;
        name?: string;
        password?: string;
      };
      if (!body.email || !body.name) {
        return send(res, 400, { error: "email and name are required" });
      }
      if (findUserByEmail(body.email)) {
        return send(res, 409, { error: "a user with this email already exists" });
      }
      const user = createUserFromRegistration({
        email: body.email,
        name: body.name,
        password: body.password ?? "",
      });
      return send(res, 201, userWire(user));
    }
  }

  // ---- custapi: organizations -------------------------------------------
  if (path[0] === "organizations") {
    // GET /organizations/search?q=&limit=
    if (method === "GET" && path[1] === "search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const matches = q
        ? db.orgs.filter((o) => o.name.toLowerCase().includes(q))
        : [];
      return send(res, 200, matches.map(orgWire));
    }
    // POST /organizations/{id}/members
    if (method === "POST" && path[1] && path[2] === "members") {
      const orgId = decodeURIComponent(path[1]);
      const body = (await readBody(req)) as { userId?: string; user_id?: string };
      const userId = body.user_id ?? body.userId;
      const org = findOrgById(orgId);
      if (!org) return send(res, 404, { error: "organization not found" });
      const user = userId ? findUserById(userId) : undefined;
      if (user && !user.organizationIds.includes(orgId)) {
        user.organizationIds.push(orgId);
      }
      return send(res, 204, {});
    }
    // GET /organizations
    if (method === "GET" && path.length === 1) {
      return send(res, 200, db.orgs.map(orgWire));
    }
  }

  // ---- ticketing: keep landing pages happy ------------------------------
  if (path[0] === "tickets") {
    if (method === "GET" && path.length === 1) return send(res, 200, []);
    if (method === "GET" && path[1]) return send(res, 404, { error: "not found" });
  }

  // ---- benign fallback ---------------------------------------------------
  if (method === "GET") return send(res, 200, []);
  return send(res, 200, {});
}

export function startStubServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      handle(req, res).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[stub] handler error", err);
        if (!res.headersSent) send(res, 500, { error: "stub error" });
      });
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

export function stopStubServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server = null;
  });
}
