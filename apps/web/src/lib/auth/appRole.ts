import type { CustApiRole, SessionPayload } from "./definitions";

/**
 * Application-level role for the experiment workflow. Mapfox admins act as lab
 * technicians; everyone else is a client.
 */
export type AppRole = "technician" | "client";

export function appRoleForCustApiRole(role: CustApiRole | undefined): AppRole {
  return role === "admin" ? "technician" : "client";
}

export function appRoleForSession(session: SessionPayload): AppRole {
  return appRoleForCustApiRole(session.role);
}
