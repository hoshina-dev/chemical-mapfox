import { myExperimentsPath } from "../experiment/routes";
import { experimentListingPath } from "../experiment-manager/routes";
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

/**
 * Post-login landing page for a role. There is no separate hub/dashboard page;
 * each role lands directly on its primary workspace and uses the nav from
 * there. Lab staff (mapfox admins) land on the staff Experiments listing;
 * everyone else lands on their own "My experiments" board.
 */
export function landingPathForRole(role: CustApiRole | undefined): string {
  return role === "admin" ? experimentListingPath() : myExperimentsPath();
}
