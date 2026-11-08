import "server-only";

import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";
import { httpStatus } from "@/lib/log/serialize";

import type { CustApiRole } from "./definitions";

/** Longest a role revoked in custapi keeps working here. */
export const ROLE_CHECK_INTERVAL_MS = 60 * 1000;
/** How long a stored role is trusted while custapi is unreachable. */
export const ROLE_STALE_MAX_MS = 60 * 60 * 1000;

export interface RefreshedUser {
  name: string;
  email: string;
  avatarUrl?: string;
  role: CustApiRole;
}

export type UserRefresh =
  | { kind: "fresh"; user: RefreshedUser }
  /** custapi says the user no longer exists. */
  | { kind: "gone" }
  /** custapi is unreachable; `usable` is whether the stored role is still trusted. */
  | { kind: "unreachable"; usable: boolean };

/**
 * Re-reads role and profile from custapi, the only owner of roles. Shared by
 * cookie sessions and MCP OAuth grants so both lose access on the same schedule.
 */
export async function refreshUser(
  userId: string,
  roleCheckedAt: number,
  now: number,
  op: string,
): Promise<UserRefresh> {
  try {
    const user = await usersApi.usersIdIdGet(userId);
    return {
      kind: "fresh",
      user: {
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role as CustApiRole,
      },
    };
  } catch (error) {
    const status = httpStatus(error);
    if (status === 404) return { kind: "gone" };
    logHandledError(error, { op, service: "custapi", userId, status });
    return {
      kind: "unreachable",
      usable: now - roleCheckedAt <= ROLE_STALE_MAX_MS,
    };
  }
}
