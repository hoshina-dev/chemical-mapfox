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
} from "../../fixtures.js";
import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * custapi (users + organizations). Ticketing/experiment-manager listing calls
 * made by post-login landing pages fall through to the server's benign
 * empty-list fallback, so pages render cleanly until a feature module owns them.
 */

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path, url } = ctx;

  // ---- custapi: users ---------------------------------------------------
  if (path[0] === "users") {
    if (method === "GET" && path[1] === "email" && path[2]) {
      const user = findUserByEmail(decodeURIComponent(path[2]));
      if (!user) return ctx.json(404, { error: "user not found" });
      return ctx.json(200, userDetailWire(user));
    }
    if (
      method === "GET" &&
      path[1] === "id" &&
      path[2] &&
      path[3] === "organizations"
    ) {
      const user = findUserById(decodeURIComponent(path[2]));
      const orgs = (user?.organizationIds ?? [])
        .map((id) => findOrgById(id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));
      return ctx.json(200, orgs.map(membershipWire));
    }
    if (method === "GET" && path[1] === "id" && path[2]) {
      const user = findUserById(decodeURIComponent(path[2]));
      if (!user) return ctx.json(404, { error: "user not found" });
      return ctx.json(200, userDetailWire(user));
    }
    if (method === "GET" && path.length === 1) {
      return ctx.json(200, db.users.map(userWire));
    }
    if (method === "POST" && path.length === 1) {
      const body = (await ctx.readBody()) as {
        email?: string;
        name?: string;
        password?: string;
      };
      if (!body.email || !body.name) {
        return ctx.json(400, { error: "email and name are required" });
      }
      if (findUserByEmail(body.email)) {
        return ctx.json(409, {
          error: "a user with this email already exists",
        });
      }
      const user = createUserFromRegistration({
        email: body.email,
        name: body.name,
        password: body.password ?? "",
      });
      return ctx.json(201, userWire(user));
    }
  }

  // ---- custapi: organizations -------------------------------------------
  if (path[0] === "organizations") {
    if (method === "GET" && path[1] === "search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const matches = q
        ? db.orgs.filter((o) => o.name.toLowerCase().includes(q))
        : [];
      return ctx.json(200, matches.map(orgWire));
    }
    if (method === "POST" && path[1] && path[2] === "members") {
      const orgId = decodeURIComponent(path[1]);
      const body = (await ctx.readBody()) as {
        userId?: string;
        user_id?: string;
      };
      const userId = body.user_id ?? body.userId;
      const org = findOrgById(orgId);
      if (!org) return ctx.json(404, { error: "organization not found" });
      const user = userId ? findUserById(userId) : undefined;
      if (user && !user.organizationIds.includes(orgId)) {
        user.organizationIds.push(orgId);
      }
      return ctx.json(204, {});
    }
    if (method === "GET" && path.length === 1) {
      return ctx.json(200, db.orgs.map(orgWire));
    }
  }

  return false;
}

registerStub({ name: "custapi", handle });
