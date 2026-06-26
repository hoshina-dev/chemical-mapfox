import "server-only";

import { usersApi } from "@/lib/custapi/client";

export interface UserOrganization {
  id: string;
  name: string;
  role?: string;
}

/**
 * The organizations the user belongs to, simplified for display in the user
 * menu. Best-effort: any failure to reach the user service yields an empty
 * list rather than throwing, since this is non-critical chrome.
 */
export async function listUserOrganizations(
  userId: string,
): Promise<UserOrganization[]> {
  try {
    const memberships = await usersApi.usersIdIdOrganizationsGet(userId);
    return memberships
      .filter((m) => m.organizationId)
      .map((m) => ({
        id: m.organizationId as string,
        name: m.organization?.name ?? (m.organizationId as string),
        role: m.role,
      }));
  } catch {
    return [];
  }
}
